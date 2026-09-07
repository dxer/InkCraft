import { createHash, randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { parseCardFields } from "./card-md";
import { getAllCards } from "./cards";
import { getDb } from "./db";
import { getAgentForStage } from "./pipeline";
import { getByok, setSetting } from "./settings";
import {
  getTopicMiningState,
  saveTopicToRepository,
  SETTING_KEY_LAST_SCANNED,
  SETTING_KEY_MINING_LAST_RESULT,
  SETTING_KEY_MINING_LOCK,
  SETTING_KEY_MINING_STARTED_AT,
  SETTING_KEY_MINING_STATUS,
  type TopicMineResult,
  type TopicMiningState,
} from "./topics";
import {
  type PlatformSkillId,
  type StructuredOutlineStep,
  type TopicRadarAngleType,
  type TopicRepositoryItem,
} from "./types";

/** 单张参与雷达碰撞的精简卡片 */
export interface RadarCardCandidate {
  id: string;
  docId: string;
  title: string;
  hook?: string;
  mechanism?: string;
  boundary?: string;
  tags: string[];
  noteTitle: string;
}

/** 候选碰撞组合（2~3张卡片） */
export interface CardCollisionPair {
  cards: RadarCardCandidate[];
  angleType: TopicRadarAngleType;
  fingerprint: string;
  similarityScore: number;
  reason: string;
}

/** 大模型返回的结构化选题 JSON 格式定义（通用母稿创作方案） */
export interface RadarGeneratedOutput {
  topic_name: string;
  angle_type: TopicRadarAngleType;
  target_audience: string;
  core_argument: string;
  title_options: string[];
  outline: Array<{
    step: string;
    referenced_card_id?: string | null;
    guideline: string;
  }>;
}

/** 计算卡片碰撞的 MD5 物理去重指纹：按卡片 ID 排序后拼接 */
export function computeCollisionFingerprint(cardIds: string[]): string {
  const sorted = [...cardIds].map((id) => String(id || "").trim()).sort();
  return createHash("md5").update(sorted.join("_")).digest("hex");
}

/** 简易 Jaccard / 关键词语义相似度计算（不依赖外部嵌入模型） */
export function computeCardJaccardSimilarity(
  c1: RadarCardCandidate,
  c2: RadarCardCandidate,
): number {
  const text1 = `${c1.title} ${c1.hook || ""} ${c1.mechanism || ""} ${c1.tags.join(" ")}`;
  const text2 = `${c2.title} ${c2.hook || ""} ${c2.mechanism || ""} ${c2.tags.join(" ")}`;

  const words1 = new Set(
    text1
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2),
  );
  const words2 = new Set(
    text2
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2),
  );

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersectionCount = 0;
  for (const w of words1) {
    if (words2.has(w)) intersectionCount++;
  }

  const unionCount = new Set([...words1, ...words2]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/** 从知识库卡片池中提纯出结构化候选卡片 */
export function loadAllRadarCandidates(): RadarCardCandidate[] {
  const rawCards = getAllCards();
  const candidates: RadarCardCandidate[] = [];

  for (const c of rawCards) {
    const fields = parseCardFields(c.content_md);
    const tags = Array.isArray(c.note_tags)
      ? c.note_tags
      : fields.frontmatter?.tags || [];

    const firstPart = fields.parts?.[0];
    const mechanismText = typeof firstPart === "string" ? firstPart : firstPart?.text || "";

    candidates.push({
      id: c.id,
      docId: c.document_id,
      title: fields.claim || fields.frontmatter?.title || "原子卡片",
      hook: fields.cut || fields.frontmatter?.hook || "",
      mechanism: mechanismText,
      boundary: fields.notApplicable || fields.applicable || "",
      tags,
      noteTitle: c.note_title || "关联笔记",
    });
  }

  return candidates;
}

/** 知识簇定义（同一父笔记的卡片聚合 + 黄金互补旧卡） */
export interface CardCluster {
  docId: string;
  noteTitle: string;
  tag: string;
  cards: RadarCardCandidate[];
  complementaryCards: RadarCardCandidate[];
  branch: "single_point" | "topic_deepening" | "topic_network";
  angleType: TopicRadarAngleType;
  reason: string;
  fingerprint: string;
}

/**
 * 构建知识簇并按三路生命周期路由（单点打透、同题深化、专题成网）
 */
export function buildCardClusters(
  candidates: RadarCardCandidate[],
  options: {
    preferredAngle?: TopicRadarAngleType | "all";
    limit?: number;
    excludeFingerprints?: Set<string>;
  } = {},
): CardCluster[] {
  const { preferredAngle = "all", limit = 3, excludeFingerprints = new Set() } = options;
  if (candidates.length === 0) return [];

  // 按父笔记 docId 聚合卡片为知识簇
  const docMap = new Map<string, RadarCardCandidate[]>();
  for (const c of candidates) {
    const list = docMap.get(c.docId) || [];
    list.push(c);
    docMap.set(c.docId, list);
  }

  // 按领域主标签归类卡片
  const tagCardMap = new Map<string, RadarCardCandidate[]>();
  for (const c of candidates) {
    const mainTag = c.tags[0] || "通用";
    const list = tagCardMap.get(mainTag) || [];
    list.push(c);
    tagCardMap.set(mainTag, list);
  }

  const clusters: CardCluster[] = [];

  for (const [docId, clusterCards] of docMap.entries()) {
    const noteTitle = clusterCards[0]?.noteTitle || "关联笔记";
    const mainTag = clusterCards[0]?.tags[0] || "通用";
    const otherCardsInSameTag = (tagCardMap.get(mainTag) || []).filter(
      (c) => c.docId !== docId,
    );

    // 软筛选：在同标签旧卡中寻找黄金相似度甜点区 (0.50 ~ 0.86)
    const complementary: Array<{ card: RadarCardCandidate; sim: number }> = [];
    for (const oldCard of otherCardsInSameTag) {
      let maxSim = 0;
      for (const cc of clusterCards) {
        const sim = computeCardJaccardSimilarity(cc, oldCard);
        if (sim > maxSim) maxSim = sim;
      }

      // 黄金相似度甜点区：排除同义反复(>0.88)与缺乏关联(<0.50)
      if (maxSim >= 0.50 && maxSim <= 0.86) {
        complementary.push({ card: oldCard, sim: maxSim });
      }
    }

    complementary.sort((a, b) => b.sim - a.sim);
    const topComplementary = complementary.slice(0, 2).map((item) => item.card);

    // 三路分支判定
    const totalInTag = (tagCardMap.get(mainTag) || []).length;
    let branch: CardCluster["branch"] = "single_point";
    let angleType: TopicRadarAngleType = "paradox";
    let reason = "";

    if (totalInTag >= 5 && otherCardsInSameTag.length >= 4) {
      // 分支 C：专题成网
      branch = "topic_network";
      angleType = "deep_dive";
      reason = `专题全景方法论：#${mainTag} 积累达 ${totalInTag} 张卡片`;
    } else if (clusterCards.length >= 2 || topComplementary.length > 0) {
      // 分支 B：同题深化 / 知识簇贯通
      branch = "topic_deepening";
      angleType =
        preferredAngle !== "all"
          ? preferredAngle
          : clusterCards.length >= 2
            ? "deep_dive"
            : "paradox";
      reason =
        clusterCards.length >= 2
          ? `知识簇内部贯通（${clusterCards.length} 张原子卡片成体系）`
          : `同题新旧碰撞（召回《${topComplementary[0]?.noteTitle}》互补视角）`;
    } else {
      // 分支 A：单点打透（冷启动）
      branch = "single_point";
      angleType = preferredAngle !== "all" ? preferredAngle : "paradox";
      reason = `单点认知穿透：深度剖析《${noteTitle}》核心 Hook 与机制`;
    }

    const allCardIds = [
      ...clusterCards.map((c) => c.id),
      ...topComplementary.map((c) => c.id),
    ];
    const fingerprint = computeCollisionFingerprint(allCardIds);

    if (excludeFingerprints.has(fingerprint)) continue;

    clusters.push({
      docId,
      noteTitle,
      tag: mainTag,
      cards: clusterCards,
      complementaryCards: topComplementary,
      branch,
      angleType,
      reason,
      fingerprint,
    });
  }

  // 若根据偏好策略筛选，优先排在前列
  if (preferredAngle !== "all") {
    clusters.sort((a, b) => (a.angleType === preferredAngle ? -1 : 1));
  }

  return clusters.slice(0, limit);
}

/** 保持向后兼容的 pair 查找器 */
export function findCollisionPairs(
  candidates: RadarCardCandidate[],
  options: {
    preferredAngle?: TopicRadarAngleType | "all";
    limit?: number;
    excludeFingerprints?: Set<string>;
  } = {},
): CardCollisionPair[] {
  const clusters = buildCardClusters(candidates, options);
  return clusters.map((c) => ({
    cards: [...c.cards, ...c.complementaryCards],
    angleType: c.angleType,
    fingerprint: c.fingerprint,
    similarityScore: 0.8,
    reason: c.reason,
  }));
}

/** 查询最近 30 天内已碰撞过的指纹集合 */
export function getRecentCollisionFingerprints(days = 30): Set<string> {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT fingerprint FROM topic_repository WHERE fingerprint IS NOT NULL AND created_at > datetime('now', '-' || ? || ' days')",
    )
    .all(days) as Array<{ fingerprint: string }>;

  return new Set(rows.map((r) => r.fingerprint));
}

function normalizeRadarOutput(
  parsed: any,
  pair: CardCollisionPair,
): RadarGeneratedOutput | null {
  if (!parsed || typeof parsed !== "object") return null;

  // 情况 1: 标准 RadarGeneratedOutput 格式
  if (parsed.topic_name || parsed.title_options || parsed.core_argument) {
    const titleOptions = Array.isArray(parsed.title_options)
      ? parsed.title_options.map(String).filter(Boolean)
      : [];
    const topicName = String(parsed.topic_name || titleOptions[0] || "").trim();
    if (topicName || titleOptions.length > 0) {
      return {
        topic_name: topicName || titleOptions[0] || "选题灵感方案",
        angle_type: parsed.angle_type || pair.angleType,
        target_audience: String(parsed.target_audience || "关注该领域的深度创作者与读者"),
        core_argument: String(parsed.core_argument || parsed.angle || "").trim(),
        title_options: titleOptions.length > 0 ? titleOptions : [topicName],
        outline: Array.isArray(parsed.outline) ? parsed.outline : [],
      };
    }
  }

  // 情况 2: 工位 agents / 旧格式返回的 angles 数组格式 { angles: [ { proposition, core_thesis, outline, ... } ] }
  if (Array.isArray(parsed.angles) && parsed.angles.length > 0) {
    const firstAngle = parsed.angles[0];
    const proposition = String(firstAngle.proposition || firstAngle.title || "").trim();
    const coreThesis = String(firstAngle.core_thesis || firstAngle.argument || firstAngle.angle || "").trim();
    const titles = parsed.angles
      .map((a: any) => String(a.proposition || a.title || "").trim())
      .filter(Boolean);

    return {
      topic_name: proposition || "选题洞察方案",
      angle_type: pair.angleType,
      target_audience: "关注该领域的深度创作者与读者",
      core_argument: coreThesis,
      title_options: titles.length > 0 ? titles : [proposition],
      outline: Array.isArray(firstAngle.outline) ? firstAngle.outline : [],
    };
  }

  // 情况 3: 直接返回包含 title 或 proposition 的单对象
  if (parsed.title || parsed.proposition) {
    const title = String(parsed.title || parsed.proposition || "").trim();
    return {
      topic_name: title,
      angle_type: pair.angleType,
      target_audience: "关注该领域的深度创作者与读者",
      core_argument: String(parsed.angle || parsed.core_thesis || parsed.argument || "").trim(),
      title_options: [title],
      outline: Array.isArray(parsed.outline) ? parsed.outline : [],
    };
  }

  return null;
}

function extractJsonFromLlmText(
  rawText: string,
  pair: CardCollisionPair,
): RadarGeneratedOutput | null {
  if (!rawText) return null;

  // 1. 过滤掉 <think>...</think> 思考链内容
  const text = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!text) return null;

  // 2. 尝试提取 ```json ... ``` 代码块
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text)) !== null) {
    const code = match[1].trim();
    try {
      const p = JSON.parse(code);
      const res = normalizeRadarOutput(p, pair);
      if (res) return res;
    } catch {
      const sanitized = code.replace(/,\s*([\]}])/g, "$1");
      try {
        const p = JSON.parse(sanitized);
        const res = normalizeRadarOutput(p, pair);
        if (res) return res;
      } catch {}
    }
  }

  // 3. 寻找最外层匹配的 { ... } (利用大括号平衡深度)
  const startIdx = text.indexOf("{");
  if (startIdx !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = startIdx; i < text.length; i++) {
      const char = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === "{") depth++;
        else if (char === "}") {
          depth--;
          if (depth === 0) {
            const candidate = text.slice(startIdx, i + 1);
            try {
              const p = JSON.parse(candidate);
              const res = normalizeRadarOutput(p, pair);
              if (res) return res;
            } catch {
              const sanitized = candidate.replace(/,\s*([\]}])/g, "$1");
              try {
                const p = JSON.parse(sanitized);
                const res = normalizeRadarOutput(p, pair);
                if (res) return res;
              } catch {}
            }
          }
        }
      }
    }
  }

  // 4. 兜底直接解析
  try {
    const p = JSON.parse(text);
    return normalizeRadarOutput(p, pair);
  } catch {}

  return null;
}
export const TOPIC_RADAR_SYSTEM_PROMPT = `你是一名顶级的创作总监兼深度思考者，擅长将零散的知识切片升华为极具传播力、立意锋利的母稿创作选题方案。

你的任务是：深度剖析系统提供的 2 到 4 张原子知识卡片，挖掘它们之间的底层机制联系、认知冲突或跨界映射，策划出 1 个立意深刻、结构严密的创作选题方案。

---

### 🚨 绝对禁止项（Negative Constraints）
1. **严禁脱离素材空想**：文章核心论证链条必须完全由输入的卡片支撑，严禁自行捏造没有卡片依据的论据。
2. **严禁平庸科普与学术课件风**：严禁起《浅谈X》、《关于Y的思考》、《X的3个技巧》等平淡标题。必须直击读者的【认知误区、痛点共鸣、反常识真相或实操机制】。
3. **严禁假大空套话**：核心论点必须明确点出“前提条件 -> 作用机制 -> 意外结果”，严禁使用“提升认知”、“倒逼成长”等空泛词汇。

---

### 🎯 策划质量准则
1. **立意锋利（Sharp Argument）**：
   - 用严格 2 句话讲透这篇文章的核心洞察，必须具备【反直觉感】或【痛点穿透力】。
2. **多风格标题矩阵（3 选 1）**：
   - **选项 1（痛点共鸣型）**：直击读者行为后果与痛点困境（例：“【痛点共鸣】别再盲目死磕了：为什么你越努力越容易掉进陷阱？”）。
   - **选项 2（反常识洞察型）**：打破主流惯性认知，制造认知张力（例：“【反常识洞察】打破主流认知的真相：为什么说‘纯靠自律’是个伪命题？”）。
   - **选项 3（机制拆解型）**：突出工程级机制解法与行动指南（例：“【机制拆解】从底层逻辑到实战落地：高效跃迁的操作指南”）。
3. **大纲结构化与卡片锚定（Card-to-Section Mapping）**：
   - 大纲段落必须精确引用对应的 \`referenced_card_id\`（必须是输入中给定的卡片 ID），讲清该段落如何利用该卡片的内容展开。

---

### 📦 输出格式规范（机器解析专用）
你必须且只能输出合法的纯 JSON 对象，严禁包裹在 \`\`\`json 之外输出任何客套话、前后缀解释或问候语。

#### 输出 JSON 模式定义：
{
  "topic_name": "核心选题主题（15字以内简短概括）",
  "angle_type": "paradox / intersection / deep_dive", 
  "target_audience": "核心受众群体及他们的具体痛点画像",
  "core_argument": "全篇核心论点（严格用2句话讲清机制与反常识真相）",
  "title_options": [
    "【痛点共鸣】备选标题1",
    "【反常识洞察】备选标题2",
    "【机制拆解】备选标题3"
  ],
  "outline": [
    {
      "step": "1. 破局引入（Hook）",
      "referenced_card_id": null,
      "guideline": "用一个极具共鸣的现实生活痛点或反直觉现象开篇，迅速抓住眼球"
    },
    {
      "step": "2. 核心机制剖析",
      "referenced_card_id": "必须精确填入对应卡片的ID",
      "guideline": "依托该卡片的核心机制，阐述底层运转原理，揭示为什么现状会发生"
    },
    {
      "step": "3. 认知误区或边界反转",
      "referenced_card_id": "必须精确填入对应卡片的ID",
      "guideline": "依托该卡片的适用边界或误区，打破读者的惯性认知，制造转折"
    },
    {
      "step": "4. 落地行动指南",
      "referenced_card_id": null,
      "guideline": "结合论证，给出读者看完即可立即执行的1~2条最小可行操作指令"
    }
  ]
}`;

/**
 * 运行智能选题雷达：基于「知识簇聚合 + 黄金互补检索 + 三路路由」策划全新选题方案
 */
export async function runTopicRadarMining(options: {
  angleType?: TopicRadarAngleType | "all";
  count?: number;
}): Promise<TopicMineResult> {
  const { angleType = "all", count = 3 } = options;
  const candidates = loadAllRadarCandidates();

  if (candidates.length === 0) {
    return {
      ran: false,
      reason: "知识库中暂无卡片资产，请先录入笔记萃取卡片",
      newNotesCount: 0,
      savedTopicsCount: 0,
      topics: [],
    };
  }

  const recentFingerprints = getRecentCollisionFingerprints(30);
  const clusters = buildCardClusters(candidates, {
    preferredAngle: angleType,
    limit: count,
    excludeFingerprints: recentFingerprints,
  });

  if (clusters.length === 0) {
    return {
      ran: false,
      reason: "当前知识库中的知识资产已完成最新选题策划。录入新笔记或提炼新卡片，即可激发全新碰撞灵感。",
      newNotesCount: 0,
      savedTopicsCount: 0,
      topics: [],
    };
  }

  const cfg = getByok();
  if (!cfg) {
    return {
      ran: false,
      reason: "请先在系统设置中配置大模型 API Key 后再触发选题雷达",
      newNotesCount: clusters.length,
      savedTopicsCount: 0,
      topics: [],
    };
  }

  const topicAgent = getAgentForStage("topic");
  const savedTopics: TopicRepositoryItem[] = [];
  let lastLlmError = "";

  for (const cluster of clusters) {
    let generated: RadarGeneratedOutput | null = null;
    const pairFallback: CardCollisionPair = {
      cards: [...cluster.cards, ...cluster.complementaryCards],
      angleType: cluster.angleType,
      fingerprint: cluster.fingerprint,
      similarityScore: 0.8,
      reason: cluster.reason,
    };

    try {
      const provider = createOpenAICompatible({
        name: "inkcraft",
        baseURL: cfg.baseUrl,
        apiKey: cfg.apiKey,
      });

      const clusterCardsText = cluster.cards
        .map(
          (c, i) =>
            `【主知识簇卡片 ${i + 1}】ID: ${c.id}\n- 标题/断言：${c.title}\n- 传播引子(Hook)：${c.hook || "无"}\n- 核心机制：${c.mechanism || "无"}\n- 边界/误区：${c.boundary || "无"}\n- 领域标签：${c.tags.join(", ") || "无"}\n- 来源笔记：《${c.noteTitle}》`,
        )
        .join("\n\n");

      const compCardsText =
        cluster.complementaryCards.length > 0
          ? `\n\n【召回的同话题黄金互补旧卡】：\n` +
            cluster.complementaryCards
              .map(
                (c, i) =>
                  `【互补旧卡 ${i + 1}】ID: ${c.id}\n- 标题/断言：${c.title}\n- 核心机制：${c.mechanism || "无"}\n- 边界/误区：${c.boundary || "无"}\n- 来源笔记：《${c.noteTitle}》`,
              )
              .join("\n\n")
          : "";

      const branchPromptDesc =
        cluster.branch === "topic_network"
          ? "【分支 C：专题全景方法论】请将整批知识卡片提炼为体系化、框架式的大纲与全景立论方案"
          : cluster.branch === "topic_deepening"
            ? "【分支 B：同题深化/知识簇贯通】请将知识簇内的多个原子卡片与互补视角融会贯通，产出深度认知反差的长文方案"
            : "【分支 A：单点穿透】请聚焦该卡片本身的 Hook 与机制，做深度的单点痛点剖析与行动指南";

      const userPrompt = `本次创作策略：${branchPromptDesc}\n\n${clusterCardsText}${compCardsText}\n\n请直接输出合法的纯 JSON 格式母稿成文方案（严格遵循系统 JSON 格式，不输出任何思考或多余文字）：`;

      const { text } = await generateText({
        model: provider.chatModel(topicAgent?.model || cfg.model),
        system: TOPIC_RADAR_SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: topicAgent?.temperature || 0.8,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(180_000),
      });

      generated = extractJsonFromLlmText(text, pairFallback);
      if (!generated) {
        lastLlmError = "大模型输出未能解析为合法选题 JSON 结构";
      }
    } catch (err) {
      console.error("[topic-radar] LLM error:", err);
      lastLlmError = err instanceof Error ? err.message : "大模型请求异常或超时";
    }

    if (!generated) {
      continue;
    }

    const targetSkill: PlatformSkillId = "master";
    const titleOptions = Array.isArray(generated.title_options)
      ? generated.title_options.map(String).filter(Boolean)
      : [];
    const mainTitle = String(
      titleOptions[1] ||
        titleOptions[0] ||
        generated.topic_name ||
        "",
    ).trim();

    if (!mainTitle) {
      continue;
    }

    const allClusterCards = [...cluster.cards, ...cluster.complementaryCards];
    const matchedCards = allClusterCards.map((c) => ({
      id: c.id,
      docId: c.docId,
      claim: c.title,
      noteTitle: c.noteTitle,
      tag: c.tags[0] || "",
    }));

    const rawOutline = Array.isArray(generated.outline) ? generated.outline : [];
    const structuredOutline: StructuredOutlineStep[] = rawOutline.map(
      (item, idx) => ({
        step: String(item?.step || `${idx + 1}. 论据展开`),
        referencedCardId: item?.referenced_card_id ? String(item.referenced_card_id) : null,
        referencedCardTitle:
          allClusterCards.find((c) => c.id === item?.referenced_card_id)?.title || null,
        guideline: String(item?.guideline || ""),
      }),
    );

    const legacyOutline = structuredOutline.map(
      (s) => `${s.step}：${s.guideline}`,
    );

    const sourceNoteIds = Array.from(new Set(allClusterCards.map((c) => c.docId)));

    const { topic } = saveTopicToRepository({
      title: mainTitle,
      angle: String(generated.core_argument || "").trim(),
      hook: String(rawOutline[0]?.guideline || "").trim(),
      targetSkill,
      angleType: generated.angle_type || cluster.angleType,
      fingerprint: cluster.fingerprint,
      targetAudience: generated.target_audience || null,
      titleOptions: titleOptions.length > 0 ? titleOptions : undefined,
      coreArgument: String(generated.core_argument || "").trim() || null,
      outlineStructured: structuredOutline,
      outline: legacyOutline,
      matchedCards,
      sourceNoteIds,
      sourceType: "auto",
      status: "idea",
    });

    savedTopics.push(topic);
  }

  if (savedTopics.length === 0) {
    return {
      ran: false,
      reason: `大模型选题生成失败: ${lastLlmError || "大模型未返回有效方案"}`,
      newNotesCount: clusters.length,
      savedTopicsCount: 0,
      topics: [],
    };
  }

  setSetting(SETTING_KEY_LAST_SCANNED, new Date().toISOString());

  return {
    ran: true,
    newNotesCount: clusters.length,
    savedTopicsCount: savedTopics.length,
    topics: savedTopics,
  };
}

/**
 * 触发异步雷达挖掘任务（非阻塞后台运行）
 */
export function triggerTopicRadarMiningAsync(options: {
  angleType?: TopicRadarAngleType | "all";
  count?: number;
}): { started: boolean; message: string; state: TopicMiningState } {
  const currentState = getTopicMiningState();
  if (currentState.isMining) {
    return {
      started: false,
      message: "选题雷达正在深度碰撞中，请稍候...",
      state: currentState,
    };
  }

  const nowIso = new Date().toISOString();
  setSetting(SETTING_KEY_MINING_STATUS, "running");
  setSetting(SETTING_KEY_MINING_STARTED_AT, nowIso);
  setSetting(SETTING_KEY_MINING_LOCK, nowIso);

  // 异步执行（后台 Promise，不阻塞 HTTP 响应）
  runTopicRadarMining(options)
    .then((res) => {
      const completedIso = new Date().toISOString();
      setSetting(SETTING_KEY_LAST_SCANNED, completedIso);
      setSetting(SETTING_KEY_MINING_STATUS, "completed");
      setSetting(SETTING_KEY_MINING_LOCK, "");
      setSetting(
        SETTING_KEY_MINING_LAST_RESULT,
        JSON.stringify({
          ran: res.ran,
          reason: res.reason,
          newNotesCount: res.newNotesCount,
          savedTopicsCount: res.savedTopicsCount,
          completedAt: completedIso,
        }),
      );
    })
    .catch((err) => {
      console.error("[topic-radar] async mining error:", err);
      const completedIso = new Date().toISOString();
      setSetting(SETTING_KEY_LAST_SCANNED, completedIso);
      setSetting(SETTING_KEY_MINING_STATUS, "failed");
      setSetting(SETTING_KEY_MINING_LOCK, "");
      setSetting(
        SETTING_KEY_MINING_LAST_RESULT,
        JSON.stringify({
          ran: false,
          error: err instanceof Error ? err.message : "雷达碰撞异常中断",
          completedAt: completedIso,
        }),
      );
    });

  return {
    started: true,
    message: "智能雷达碰撞任务已在后台启动",
    state: getTopicMiningState(),
  };
}
