import { createHash, randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { parseCardFields } from "./card-md";
import { getAllCards } from "./cards";
import { getDb } from "./db";
import { getAgentForStage } from "./pipeline";
import { getByok } from "./settings";
import {
  saveTopicToRepository,
  type TopicMineResult,
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

/** 大模型返回的结构化选题 JSON 格式定义 */
export interface RadarGeneratedOutput {
  topic_name: string;
  angle_type: TopicRadarAngleType;
  target_audience: string;
  recommended_platform: "xiaohongshu" | "wechat" | "twitter" | "zhihu" | "master";
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
  const sorted = [...cardIds].map((id) => id.trim()).sort();
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

/**
 * 挖掘可碰撞的候选卡片组合（三种模式）：
 * 1. 反差碰撞（Paradox）：相似度 0.15 ~ 0.45（关键词张力区间），或包含机制与边界对立
 * 2. 跨界同构（Intersection）：来自不同主标签（tagA !== tagB），底层机制有交叉
 * 3. 专题纵深（Deep Dive）：来自相同主标签，逻辑前后承接
 */
export function findCollisionPairs(
  candidates: RadarCardCandidate[],
  options: {
    preferredAngle?: TopicRadarAngleType | "all";
    limit?: number;
    excludeFingerprints?: Set<string>;
  } = {},
): CardCollisionPair[] {
  const { preferredAngle = "all", limit = 6, excludeFingerprints = new Set() } = options;
  const pairs: CardCollisionPair[] = [];

  if (candidates.length < 2) return pairs;

  const n = candidates.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c1 = candidates[i];
      const c2 = candidates[j];
      const fingerprint = computeCollisionFingerprint([c1.id, c2.id]);

      if (excludeFingerprints.has(fingerprint)) continue;

      const sim = computeCardJaccardSimilarity(c1, c2);
      const tag1 = c1.tags[0] || "通用";
      const tag2 = c2.tags[0] || "通用";
      const hasSharedTag = tag1 === tag2 && tag1 !== "通用";

      // 1. 模式 1：反差碰撞（Paradox Mode）
      if (
        (preferredAngle === "all" || preferredAngle === "paradox") &&
        ((sim >= 0.12 && sim <= 0.45) ||
          (c1.boundary && c2.mechanism && sim >= 0.08))
      ) {
        pairs.push({
          cards: [c1, c2],
          angleType: "paradox",
          fingerprint,
          similarityScore: sim,
          reason: `认知张力碰撞：${c1.title} ↔ ${c2.title}`,
        });
      }

      // 2. 模式 2：跨界同构（Intersection Mode）
      if (
        (preferredAngle === "all" || preferredAngle === "intersection") &&
        !hasSharedTag &&
        (sim >= 0.06 || (c1.tags.length > 0 && c2.tags.length > 0))
      ) {
        pairs.push({
          cards: [c1, c2],
          angleType: "intersection",
          fingerprint,
          similarityScore: sim,
          reason: `跨领域隐喻映射：#${tag1} ➔ #${tag2}`,
        });
      }

      // 3. 模式 3：专题纵深（Deep Dive Mode）
      if (
        (preferredAngle === "all" || preferredAngle === "deep_dive") &&
        hasSharedTag &&
        sim <= 0.75
      ) {
        pairs.push({
          cards: [c1, c2],
          angleType: "deep_dive",
          fingerprint,
          similarityScore: sim,
          reason: `体系化干货串联：#${tag1} 专题深入`,
        });
      }
    }
  }

  // 排序打乱并去重取前 N 个
  return pairs
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
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

/** 顶级内容总监 System Prompt */
export const TOPIC_RADAR_SYSTEM_PROMPT = `你是一名顶级的全网自媒体内容总监兼爆款操盘手，精通微信公众号（深度叙事/认知重塑）、小红书（痛点直击/反常识吸睛）与知乎/即刻/X（高信息密度/锋利金句）的传播逻辑。

你的任务是：深度剖析系统提供的 2 到 4 张原子知识卡片，挖掘它们之间的底层机制联系、认知冲突或跨界映射，策划出 1 个极具传播爆发力的自媒体成文方案。

---

### 🚨 绝对禁止项（Negative Constraints）
1. **严禁脱离素材空想**：文章核心论证链条必须完全由输入的卡片支撑，严禁自行捏造没有卡片依据的论据。
2. **严禁平庸科普与学术课件风**：严禁起《浅谈X》、《关于Y的思考》、《X的3个技巧》等平淡标题。必须直击读者的【认知误区、痛点焦虑、反常识真相或执行代价】。
3. **严禁假大空套话**：核心论点必须明确点出“前提条件 -> 作用机制 -> 意外结果”，严禁使用“提升认知”、“倒逼成长”等空泛词汇。

---

### 🎯 策划质量准则
1. **立意锋利（Sharp Argument）**：
   - 用严格 2 句话讲透这篇文章的核心洞察，必须具备【反直觉感】或【痛点穿透力】。
2. **多风格标题矩阵（3 选 1）**：
   - **选项 1（痛点焦虑型）**：适合小红书/即刻，直击读者行为后果（例：“你以为在高效多线程，其实大脑在持续断崖式掉帧”）。
   - **选项 2（反常识冲突型）**：适合公众号头条，击碎主流常识（例：“为什么越自律的人越容易内耗？聊聊意志力的残酷真相”）。
   - **选项 3（实操干货型）**：适合技术/知乎/方法论长文，突出工程级解法（例：“告别玄学写代码：Vibe Coding 的边界锁定实战指南”）。
3. **大纲结构化与卡片锚定（Card-to-Section Mapping）**：
   - 大纲段落必须精确引用对应的 \`referenced_card_id\`（必须是输入中给定的卡片 ID），讲清该段落如何利用该卡片的内容展开。

---

### 📦 输出格式规范（机器解析专用）
你必须且只能输出合法的纯 JSON 对象，严禁包裹在 \`\`\`json 之外输出任何客套话、前后缀解释或问候语。

#### 输出 JSON 模式定义：
{
  "topic_name": "核心选题主题（15字以内简短概括）",
  "angle_type": "paradox / intersection / deep_dive", 
  "target_audience": "核心读者群体及他们的具体痛点画像",
  "recommended_platform": "xiaohongshu / wechat / twitter / zhihu",
  "core_argument": "全篇核心论点（严格用2句话讲清机制与反常识真相）",
  "title_options": [
    "【痛点焦虑型】备选标题1",
    "【反常识冲突型】备选标题2",
    "【实操干货型】备选标题3"
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
 * 运行智能选题雷达：从原子卡片库中通过碰撞策略生成全新选题并持久化
 */
export async function runTopicRadarMining(options: {
  angleType?: TopicRadarAngleType | "all";
  count?: number;
}): Promise<TopicMineResult> {
  const { angleType = "all", count = 3 } = options;
  const candidates = loadAllRadarCandidates();

  if (candidates.length < 2) {
    return {
      ran: false,
      reason: "卡片库中原子卡片数量不足（需至少 2 张卡片），请先录入笔记萃取卡片",
      newNotesCount: 0,
      savedTopicsCount: 0,
      topics: [],
    };
  }

  const recentFingerprints = getRecentCollisionFingerprints(30);
  const pairs = findCollisionPairs(candidates, {
    preferredAngle: angleType,
    limit: count * 2,
    excludeFingerprints: recentFingerprints,
  });

  if (pairs.length === 0) {
    return {
      ran: false,
      reason: "近 30 天内所有有效卡片组合均已完成碰撞，无新碰撞组合（0 Token 消耗）",
      newNotesCount: 0,
      savedTopicsCount: 0,
      topics: [],
    };
  }

  const selectedPairs = pairs.slice(0, count);
  const cfg = getByok();
  const topicAgent = getAgentForStage("topic");
  const savedTopics: TopicRepositoryItem[] = [];

  for (const pair of selectedPairs) {
    let generated: RadarGeneratedOutput | null = null;

    if (cfg) {
      try {
        const provider = createOpenAICompatible({
          name: "inkcraft",
          baseURL: cfg.baseUrl,
          apiKey: cfg.apiKey,
        });

        const cardsText = pair.cards
          .map(
            (c, i) =>
              `【卡片 ${i + 1}】ID: ${c.id}\n- 标题/断言：${c.title}\n- 传播引子(Hook)：${c.hook || "无"}\n- 核心机制：${c.mechanism || "无"}\n- 边界/误区：${c.boundary || "无"}\n- 概念标签：${c.tags.join(", ") || "无"}\n- 来源笔记：《${c.noteTitle}》`,
          )
          .join("\n\n");

        const userPrompt = `本次碰撞策略：【${pair.angleType === "paradox" ? "反差碰撞（找认知张力）" : pair.angleType === "intersection" ? "跨界同构（跨领域隐喻）" : "专题纵深（系统化进阶）"}】\n\n【参与碰撞的原子知识卡片资产】：\n${cardsText}\n\n请严格按顶级自媒体内容总监标准，输出合法的纯 JSON 成文方案：`;

        const { text } = await generateText({
          model: provider.chatModel(topicAgent?.model || cfg.model),
          system: topicAgent?.system_prompt || TOPIC_RADAR_SYSTEM_PROMPT,
          prompt: userPrompt,
          temperature: topicAgent?.temperature || 0.8,
          maxRetries: 1,
          abortSignal: AbortSignal.timeout(60_000),
        });

        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start !== -1 && end > start) {
          generated = JSON.parse(text.slice(start, end + 1)) as RadarGeneratedOutput;
        }
      } catch (err) {
        console.error("[topic-radar] LLM error:", err);
      }
    }

    // 本地降级生成
    if (!generated) {
      const c1 = pair.cards[0];
      const c2 = pair.cards[1];
      const p1 = c1.title.replace(/[。！？]$/, "");
      const p2 = c2.title.replace(/[。！？]$/, "");

      generated = {
        topic_name: `${c1.tags[0] || "思维"}与${c2.tags[0] || "实践"}的张力破局`,
        angle_type: pair.angleType,
        target_audience: "关注个人成长与高效工程思维的知识创作者及自媒体读者",
        recommended_platform: "wechat",
        core_argument: `绝大多数人常误以为“${p1}”，然而在深层机制上，“${p2}”才是打破认知死循环的决定性抓手。`,
        title_options: [
          `【痛点焦虑型】别再盲目死磕了：为什么你越努力，越容易掉进「${p1}」的陷阱？`,
          `【反常识冲突型】打破主流认知的残酷真相：为什么说「${p1}」往往是个伪命题？`,
          `【实操干货型】从机制到行动：如何借助「${p2}」实现高效跃迁实战指南`,
        ],
        outline: [
          {
            step: "1. 破局引入（Hook）",
            referenced_card_id: null,
            guideline: "用日常场景中的普遍行为误区切入，点出为什么越想破局越焦虑",
          },
          {
            step: "2. 核心机制剖析",
            referenced_card_id: c1.id,
            guideline: `依托《${c1.noteTitle}》，阐述核心机制运转规律与底层原理`,
          },
          {
            step: "3. 认知误区或边界反转",
            referenced_card_id: c2.id,
            guideline: `依托《${c2.noteTitle}》，揭示适用边界，击碎读者惯性误区`,
          },
          {
            step: "4. 落地行动指南",
            referenced_card_id: null,
            guideline: "给出 2 条清晰、可立即在实际工作流中执行的最小可行清单",
          },
        ],
      };
    }

    // 转换成标准平台技能
    let targetSkill: PlatformSkillId = "wechat";
    if (generated.recommended_platform === "xiaohongshu") targetSkill = "xiaohongshu";
    else if (generated.recommended_platform === "zhihu") targetSkill = "zhihu";
    else if (generated.recommended_platform === "twitter") targetSkill = "x_thread";
    else if (generated.recommended_platform === "master") targetSkill = "master";

    // 默认选用第二个反常识或第一个痛点标题
    const mainTitle =
      generated.title_options?.[1] ||
      generated.title_options?.[0] ||
      generated.topic_name;

    const matchedCards = pair.cards.map((c) => ({
      id: c.id,
      docId: c.docId,
      claim: c.title,
      noteTitle: c.noteTitle,
      tag: c.tags[0] || "",
    }));

    const structuredOutline: StructuredOutlineStep[] = (generated.outline || []).map(
      (item) => ({
        step: item.step,
        referencedCardId: item.referenced_card_id || null,
        referencedCardTitle:
          pair.cards.find((c) => c.id === item.referenced_card_id)?.title || null,
        guideline: item.guideline,
      }),
    );

    const legacyOutline = structuredOutline.map(
      (s) => `${s.step}：${s.guideline}`,
    );

    const sourceNoteIds = Array.from(new Set(pair.cards.map((c) => c.docId)));

    const { topic } = saveTopicToRepository({
      title: mainTitle,
      angle: generated.core_argument,
      hook: generated.outline?.[0]?.guideline || "",
      targetSkill,
      angleType: generated.angle_type || pair.angleType,
      fingerprint: pair.fingerprint,
      targetAudience: generated.target_audience,
      titleOptions: generated.title_options,
      coreArgument: generated.core_argument,
      outlineStructured: structuredOutline,
      outline: legacyOutline,
      matchedCards,
      sourceNoteIds,
      sourceType: "auto",
      status: "idea",
    });

    savedTopics.push(topic);
  }

  return {
    ran: true,
    newNotesCount: selectedPairs.length,
    savedTopicsCount: savedTopics.length,
    topics: savedTopics,
  };
}
