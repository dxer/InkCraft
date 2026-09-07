import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { getDb } from "./db";
import { getByok, type ByokConfig } from "./settings";

export interface MediaTopic {
  platform: "xiaohongshu" | "wechat" | "general";
  title: string;
  hook: string;
  angle?: string;
  outline?: string[];
}

export interface DocumentExtractionItem {
  id: string;
  document_id: string;
  counter_intuition: string; // 1. 核心反常识认知：常识假象 vs 本质真相
  hardcore_evidence: string; // 2. 关键硬核论据：数据点与真实商业/实战案例
  causal_chain: string; // 3. 底层因果链：4步机理推导模型 (A -> B -> C -> D)
  bias_and_blindspots: string; // 4. 潜在偏见与反脆弱盲点：隐藏假设与失效边界
  media_topics: MediaTopic[]; // 5. 3 个自媒体切入选题 (附带 3 秒抓人 Hook 与 3 段式起草大纲)
  raw_json?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MinedInsightItem {
  id: string;
  title: string;
  insight_type: "tension" | "cross_domain" | "gap";
  description: string;
  source_claim_ids: string[];
  status: "unread" | "starred" | "used";
  created_at: string;
  sources?: {
    claimId: string;
    documentId: string;
    documentTitle: string;
    claimText: string;
    counterView?: string | null;
    domainTag?: string | null;
    causalChain?: string | null;
  }[];
}

/**
 * 出版级 5 维度深度知识晶体萃取：
 * 融合智鉴 4 维思辨（精炼、解构、反辩、延展），为后续长文装配提供高密度骨架与事实弹药。
 */
export async function extract5DExtractionFromDoc(
  docId: string,
  content: string,
  options: { persist?: boolean } = {},
): Promise<DocumentExtractionItem | null> {
  if (!content || content.trim().length < 20) {
    return null;
  }

  const db = getDb();
  let extracted: any = null;

  const cfg = getByok();
  if (cfg) {
    try {
      const clipped =
        content.length > 5000
          ? `${content.slice(0, 3000)}\n……\n${content.slice(-2000)}`
          : content;
      extracted = await callLlmJsonObject(cfg, EXTRACT_5D_SYSTEM, clipped);
    } catch (err) {
      console.warn("[claims] 5D extraction LLM call failed, fallback:", err);
    }
  }

  if (!extracted || typeof extracted !== "object") {
    extracted = generateFallback5DExtraction(content);
  }

  // 整理高密度数据结构
  const counterIntuition =
    String(extracted.counter_intuition || extracted.counterIntuition || "")
      .trim()
      .slice(0, 600) ||
    "【常识假象 vs 本质真相】大众往往以为工具和操作是核心，但本质上是底层认知与因果链条的闭环设计。";
  const hardcoreEvidence =
    String(extracted.hardcore_evidence || extracted.hardcoreEvidence || "")
      .trim()
      .slice(0, 800) ||
    "文中贯穿了具体的真实实践案例与指标验证，提供了扎实的论据支撑。";
  const causalChain =
    String(extracted.causal_chain || extracted.causalChain || "")
      .trim()
      .slice(0, 400) ||
    "识别认知偏差 -> 重构底层假设 -> 建立闭环系统 -> 产生复利成果";
  const biasAndBlindspots =
    String(extracted.bias_and_blindspots || extracted.biasAndBlindspots || "")
      .trim()
      .slice(0, 600) ||
    "【隐藏假设与失效边界】该推论默认了持续投入与低延迟反馈，在特定极端或规模化边界条件下可能面临边际效用递减。";

  let mediaTopics: MediaTopic[] = [];
  if (Array.isArray(extracted.media_topics || extracted.mediaTopics)) {
    const list = extracted.media_topics || extracted.mediaTopics;
    mediaTopics = list
      .filter((t: any) => typeof t === "object" && t !== null && t.title)
      .map((t: any) => ({
        platform: ["xiaohongshu", "wechat", "general"].includes(t.platform)
          ? t.platform
          : "general",
        title: String(t.title).trim().slice(0, 60),
        hook: String(t.hook || "")
          .trim()
          .slice(0, 100),
        angle: t.angle ? String(t.angle).trim().slice(0, 150) : undefined,
        outline: Array.isArray(t.outline)
          ? t.outline.map((o: any) => String(o).trim()).slice(0, 3)
          : [
              "引子：核心矛盾与认知失调呈现",
              "展开：多维解构与事实论据交织",
              "升华：破局洞见与实践方法论",
            ],
      }))
      .slice(0, 3);
  }

  if (mediaTopics.length === 0) {
    mediaTopics = [
      {
        platform: "xiaohongshu",
        title: "为什么 90% 的人都理解错了这套逻辑？",
        hook: "“别再迷信表层技巧了，底层因果链才是拉开差距的关键。”",
        angle: "直击大众常识误区，给出 3 个反直觉破局清单",
        outline: [
          "认知误区：大众普遍踩中的 3 个坑",
          "本质拆解：真正拉开差距的底层变量",
          "行动清单：普通人可立即迁移的执行步骤",
        ],
      },
      {
        platform: "wechat",
        title: "深度长文：从本质认知到实战破局",
        hook: "“真正的竞争优势，建立在打破直觉的非共识洞察之上。”",
        angle: "破除二元对立，构建完整商业与认知框架",
        outline: [
          "思想引子：表面对立背后的本质真相",
          "事实弹药：关键案例与推导链条解构",
          "落地法则：超越二元论的深层方法论",
        ],
      },
      {
        platform: "general",
        title: "反常识法则：被忽略的关键变量",
        hook: "“一文拆解 3 个最具颠覆性的思考模型。”",
        angle: "方法论归纳与决策迁移",
        outline: [
          "问题提出：为什么传统解法逐渐失效？",
          "因果溯源：隐藏动力学机制剖析",
          "终态跃迁：建立个人与业务的反脆弱系统",
        ],
      },
    ];
  }

  const id = randomUUID();
  const rawJson = JSON.stringify({
    counter_intuition: counterIntuition,
    hardcore_evidence: hardcoreEvidence,
    causal_chain: causalChain,
    bias_and_blindspots: biasAndBlindspots,
    media_topics: mediaTopics,
  });

  // document_extractions 表归 sprout 发芽档案所有（document_id UNIQUE，last-write-wins）：
  // 淘金补档必须 persist:false，否则会覆盖 sprout 的 raw_json，导致知识页发芽面板读到脏数据。
  if (options.persist !== false) {
    db.prepare(`
      INSERT INTO document_extractions (
        id, document_id, counter_intuition, hardcore_evidence, causal_chain, bias_and_blindspots, media_topics, raw_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(document_id) DO UPDATE SET
        counter_intuition = excluded.counter_intuition,
        hardcore_evidence = excluded.hardcore_evidence,
        causal_chain = excluded.causal_chain,
        bias_and_blindspots = excluded.bias_and_blindspots,
        media_topics = excluded.media_topics,
        raw_json = excluded.raw_json,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      id,
      docId,
      counterIntuition,
      hardcoreEvidence,
      causalChain,
      biasAndBlindspots,
      JSON.stringify(mediaTopics),
      rawJson,
    );

    // 同步在 knowledge_claims 中存入精粹微粒（用于兼容旧索引）
    db.prepare("DELETE FROM knowledge_claims WHERE document_id = ?").run(docId);
    db.prepare(`
      INSERT INTO knowledge_claims (id, document_id, claim_text, counter_view, domain_tag)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      docId,
      counterIntuition,
      biasAndBlindspots,
      "核心认知",
    );
  }

  return {
    id,
    document_id: docId,
    counter_intuition: counterIntuition,
    hardcore_evidence: hardcoreEvidence,
    causal_chain: causalChain,
    bias_and_blindspots: biasAndBlindspots,
    media_topics: mediaTopics,
    raw_json: rawJson,
  };
}

/**
 * 兼容旧方法：直接委托给 5D 萃取
 */
/**
 * 全库轻量淘金：
 * 只读取各篇文档已萃取的 5 维度摘要（反常识认知、因果链与盲点），Token 消耗极低，
 * 寻找不同文章之间的思维模型对立与张力，产出高穿透力长文选题。
 */
export async function mineInsights(options?: {
  kbId?: string;
}): Promise<MinedInsightItem[]> {
  const db = getDb();

  // 1. 获取候选 5 维萃取档案（包含反常识、因果链、盲点）
  let extractionsQuery = `
    SELECT de.id, de.document_id, de.counter_intuition, de.causal_chain, de.bias_and_blindspots, ki.title as doc_title
    FROM document_extractions de
    JOIN knowledge_items ki ON de.document_id = ki.id
  `;
  const params: unknown[] = [];
  if (options?.kbId && options.kbId !== "all") {
    extractionsQuery += " WHERE ki.kb_id = ?";
    params.push(options.kbId);
  }
  extractionsQuery += " ORDER BY de.updated_at DESC LIMIT 10";

  const rawExtractions = db.prepare(extractionsQuery).all(...params) as {
    id: string;
    document_id: string;
    counter_intuition: string;
    causal_chain: string;
    bias_and_blindspots: string;
    doc_title: string;
  }[];

  // 若不足 2 篇萃取，从既有笔记在内存中补齐（persist:false —— document_extractions 归 sprout，
  // 原实现落库会覆盖 sprout 的 raw_json，导致发芽档案数据损坏）
  const transientExtractions: typeof rawExtractions = [];
  if (rawExtractions.length < 2) {
    const unextractedNotes = db
      .prepare(`
        SELECT id, content, title FROM knowledge_items 
        WHERE id NOT IN (SELECT document_id FROM document_extractions)
        AND chunk_index IS NULL AND length(content) > 30
        LIMIT 3
      `)
      .all() as { id: string; content: string; title: string | null }[];

    for (const n of unextractedNotes) {
      const ext = await extract5DExtractionFromDoc(n.id, n.content, {
        persist: false,
      });
      if (ext) {
        transientExtractions.push({
          id: ext.id,
          document_id: ext.document_id,
          counter_intuition: ext.counter_intuition,
          causal_chain: ext.causal_chain,
          bias_and_blindspots: ext.bias_and_blindspots,
          doc_title: n.title || "未命名笔记",
        });
      }
    }
  }

  // 库内萃档（多为 sprout 写入）+ 本次瞬态补档合并后参与张力合成
  const readyExtractions = [...rawExtractions, ...transientExtractions];

  if (readyExtractions.length < 2) {
    return getMinedInsights();
  }

  const cfg = getByok();
  let generated: any[] = [];

  if (cfg) {
    try {
      const compressedPayload = readyExtractions.map((e) => ({
        doc_id: e.document_id,
        doc_title: e.doc_title,
        counter_intuition: e.counter_intuition,
        causal_chain: e.causal_chain,
        bias_and_blindspots: e.bias_and_blindspots,
      }));

      const prompt = `你是一位顶级思想专栏主编。以下是用户知识库中已提炼的【精益知识晶体档案】（每篇文章已浓缩为反常识认知、因果链与潜在盲点）：\n${JSON.stringify(
        compressedPayload,
        null,
        2,
      )}\n\n任务要求：
1. 深入比对不同文章的“因果链对立”或“反常识与盲点的碰撞”，找出最具张力的 2 组思想冲突。
2. 为每组冲突锻造一个极具穿透力的长文命题与抓人解读。
3. 输出 JSON 数组格式：
[
  {
    "title": "长文选题命题名称（15-28字）",
    "type": "tension", // "tension"(观点冲突) | "cross_domain"(跨界碰撞) | "gap"(认知盲区)
    "description": "张力解析（对比两者的因果链与本质分歧，100-200字）",
    "doc_ids": ["doc_id_1", "doc_id_2"] // 必须使用上述列表中的真实 doc_id
  }
]`;

      const res = await callLlmJsonArray(cfg, MINE_INSIGHTS_SYSTEM, prompt);
      if (Array.isArray(res)) {
        generated = res
          .filter(
            (
              item,
            ): item is {
              title: string;
              type?: any;
              description: string;
              doc_ids?: any;
            } =>
              typeof item === "object" &&
              item !== null &&
              typeof (item as any).title === "string" &&
              typeof (item as any).description === "string",
          )
          .map((item) => {
            const validDocIds = Array.isArray(item.doc_ids)
              ? item.doc_ids.filter((did) =>
                  readyExtractions.some((re) => re.document_id === did),
                )
              : [];
            return {
              title: String(item.title).trim().slice(0, 100),
              type: ["tension", "cross_domain", "gap"].includes(item.type)
                ? item.type
                : "tension",
              description: String(item.description).trim().slice(0, 500),
              doc_ids:
                validDocIds.length > 0
                  ? validDocIds
                  : [
                      readyExtractions[0].document_id,
                      readyExtractions[1].document_id,
                    ],
            };
          });
      }
    } catch (err) {
      console.warn(
        "[claims] Light-weight mining LLM call failed, fallback:",
        err,
      );
    }
  }

  // 降级生成
  if (generated.length === 0) {
    const e1 = readyExtractions[0];
    const e2 = readyExtractions[1];
    generated = [
      {
        title: `双重反常识碰撞：《${e1.doc_title}》与《${e2.doc_title}》的底层张力`,
        type: "tension",
        description: `《${e1.doc_title}》强调「${e1.counter_intuition.slice(0, 35)}...」（因果链：${e1.causal_chain}），而《${e2.doc_title}》则指出「${e2.counter_intuition.slice(0, 35)}...」。两者的对撞揭示了在不同业务边界下的取舍代价。`,
        doc_ids: [e1.document_id, e2.document_id],
      },
    ];
  }

  // 写入 mined_insights 表
  const insert = db.prepare(`
    INSERT INTO mined_insights (id, title, insight_type, description, source_claim_ids, status)
    VALUES (?, ?, ?, ?, ?, 'unread')
  `);

  for (const item of generated) {
    const id = randomUUID();
    insert.run(
      id,
      item.title,
      item.type || "tension",
      item.description,
      JSON.stringify(item.doc_ids || []),
    );
  }

  return getMinedInsights();
}

/**
 * 获取已持久化的洞察列表并挂载关联来源
 */
export function getMinedInsights(status?: string): MinedInsightItem[] {
  const db = getDb();
  let query = "SELECT * FROM mined_insights";
  const params: unknown[] = [];
  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at DESC LIMIT 30";

  const rows = db.prepare(query).all(...params) as {
    id: string;
    title: string;
    insight_type: "tension" | "cross_domain" | "gap";
    description: string;
    source_claim_ids: string;
    status: "unread" | "starred" | "used";
    created_at: string;
  }[];

  if (rows.length === 0) return [];

  const allDocIds = new Set<string>();
  const parsedMap = new Map<string, string[]>();

  for (const r of rows) {
    try {
      const ids = JSON.parse(r.source_claim_ids);
      if (Array.isArray(ids)) {
        parsedMap.set(r.id, ids);
        ids.forEach((id) => allDocIds.add(id));
      }
    } catch {
      parsedMap.set(r.id, []);
    }
  }

  const extractionDetailMap = new Map<
    string,
    {
      documentId: string;
      documentTitle: string;
      counterIntuition: string;
      causalChain: string;
    }
  >();

  if (allDocIds.size > 0) {
    const placeholders = Array.from(allDocIds)
      .map(() => "?")
      .join(",");
    const details = db
      .prepare(`
        SELECT ki.id as documentId, ki.title as documentTitle,
               COALESCE(de.counter_intuition, ki.content) as counterIntuition,
               COALESCE(de.causal_chain, '直接推导') as causalChain
        FROM knowledge_items ki
        LEFT JOIN document_extractions de ON ki.id = de.document_id
        WHERE ki.id IN (${placeholders})
      `)
      .all(...Array.from(allDocIds)) as {
      documentId: string;
      documentTitle: string;
      counterIntuition: string;
      causalChain: string;
    }[];

    details.forEach((d) => extractionDetailMap.set(d.documentId, d));
  }

  return rows.map((r) => {
    const docIds = parsedMap.get(r.id) || [];
    const sources = docIds
      .map((id) => {
        const d = extractionDetailMap.get(id);
        if (!d) return null;
        return {
          claimId: id,
          documentId: d.documentId,
          documentTitle: d.documentTitle,
          claimText: d.counterIntuition,
          causalChain: d.causalChain,
        };
      })
      .filter((s): s is NonNullable<typeof s> => !!s);

    return {
      id: r.id,
      title: r.title,
      insight_type: r.insight_type,
      description: r.description,
      source_claim_ids: docIds,
      status: r.status,
      created_at: r.created_at,
      sources,
    };
  });
}

/**
 * 更新洞察状态
 */
export function updateMinedInsight(
  id: string,
  updates: { status?: "unread" | "starred" | "used" },
): void {
  const db = getDb();
  if (updates.status) {
    db.prepare("UPDATE mined_insights SET status = ? WHERE id = ?").run(
      updates.status,
      id,
    );
  }
}

/**
 * 删除洞察
 */
export function deleteMinedInsight(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM mined_insights WHERE id = ?").run(id);
}

// -------------------------------------------------------------
// Prompts & Helpers
// -------------------------------------------------------------

const EXTRACT_5D_SYSTEM = [
  "你是顶级出版物主编、认知解构专家与金牌内容策展人。你的任务是对输入的文章进行深度解构，萃取具有极高内容密度、思辨穿透力与实战创作价值的「5 维出版级知识晶体档案」。",
  "请严格提取以下 5 个维度，并确保每个维度的信息具体、硬核、拒绝空泛套话：",
  "",
  "1. counter_intuition: 【核心反常识认知】",
  "   - 结构要求：清晰对比「常识假象 vs 本质真相」。格式为：『【常识假象 vs 本质真相】大众往往误以为……，但本质机理是……，因为……』",
  "   - 必须直击第一性原理，破除直觉偏见与线性归因。（80-180字）",
  "",
  "2. hardcore_evidence: 【关键硬核论据与案例（写作弹药库）】",
  "   - 必须从原文中提取具体的数据点/比例、公司/项目/人物案例、实验结论或特定实战机制。",
  "   - 拒绝主观修饰，提取客观、可验证、能在长文起草中直接作为证据引用的客观切片。（80-200字）",
  "",
  "3. causal_chain: 【底层因果推导链（机理模型）】",
  "   - 必须拆解为 4 步动态推导逻辑闭环，严格采用箭头形式：『诱发诱因 -> 核心作用机制 -> 结构性形变 -> 终态复利/次生效应』",
  "   - 确保每一步都包含具体的业务动作或思考机制，排除无意义的抽象同义词。（50-150字）",
  "",
  "4. bias_and_blindspots: 【潜在偏见与反脆弱盲点（红队反辩）】",
  "   - 结构要求：『【隐藏假设与失效边界】该论断默认了……前提，在……场景下会彻底失效或引发反作用力』",
  "   - 深度挑刺：指出作者未提及的隐形成本、极端边界或反例，为长文提供天然的辩证视角。（60-150字）",
  "",
  "5. media_topics: 【3 个高转化长文/社媒切入选题】（JSON 数组，3 项）：",
  "   - 项 1 (platform='xiaohongshu'): 痛点反差清单，title (爆款标题, 18-28字), hook (前3秒抓人黄金Hook, 20-50字), angle (切入视角), outline (3段式起草骨架数组)",
  "   - 项 2 (platform='wechat'): 公众号深度长文，title (破除二元对立的框架命题, 18-28字), hook (思想张力引子), angle (深度框架剖析), outline (3段式起草骨架数组)",
  "   - 项 3 (platform='general'): 知乎/专栏深度破局，title (本质归因与方法论, 18-28字), hook (穿透性设问), angle (实战迁移法则), outline (3段式起草骨架数组)",
  "",
  "请务必输出合法的单个 JSON 对象，不要输出任何多余的 Markdown 标记外的文字。",
].join("\n");

const MINE_INSIGHTS_SYSTEM =
  "你是顶级专栏主编。你的任务是交叉比对不同文章已萃取的反常识认知与因果链对立，挖掘出最具穿透力的深度长文选题。务必只输出合法 JSON 数组。";

async function callLlmJsonObject(
  cfg: ByokConfig,
  system: string,
  prompt: string,
): Promise<Record<string, unknown> | null> {
  const provider = createOpenAICompatible({
    name: "inkcraft",
    baseURL: cfg.baseUrl,
    apiKey: cfg.apiKey,
  });
  const { text } = await generateText({
    model: provider.chatModel(cfg.model),
    system,
    prompt,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(60_000),
  });
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callLlmJsonArray(
  cfg: ByokConfig,
  system: string,
  prompt: string,
): Promise<unknown[] | null> {
  const provider = createOpenAICompatible({
    name: "inkcraft",
    baseURL: cfg.baseUrl,
    apiKey: cfg.apiKey,
  });
  const { text } = await generateText({
    model: provider.chatModel(cfg.model),
    system,
    prompt,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(60_000),
  });
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function generateFallback5DExtraction(
  content: string,
): Record<string, unknown> {
  const lines = content
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(
      (l) => l.length >= 15 && !l.startsWith("#") && !l.startsWith("http"),
    );
  const first = lines[0] || "表层的通用技巧往往掩盖了更底层的因果闭环机制";
  const mid =
    lines[Math.floor(lines.length / 2)] ||
    "关键在于建立可复现的验证链条与反馈闭环";

  return {
    counter_intuition: `【常识假象 vs 本质真相】大众往往误以为解决问题的关键在于堆叠工具与动作，但本质机理是：『${first.slice(0, 90)}』，单点的经验模仿往往在复杂系统面前失效。`,
    hardcore_evidence: `【写作事实弹药库】文中以真实业务与实践场景作为关键支撑：「${mid.slice(0, 120)}」，验证了认知模型在实际推进中的演进路径与边界约束。`,
    causal_chain:
      "识别系统隐性痛点 -> 破除直觉线性假设 -> 引入因果闭环机制 -> 放大网络复利价值",
    bias_and_blindspots:
      "【隐藏假设与失效边界】该论断默认了执行主体具备充足的初始资源与低试错成本，在强外部不确定性或重度受限的场景下可能产生次生摩擦。",
    media_topics: [
      {
        platform: "xiaohongshu",
        title: "为什么 90% 的人都理解错了这套底层逻辑？",
        hook: "“别再迷信表层技巧了，底层因果链才是拉开差距的关键。”",
        angle: "破除 3 大直觉误区，给出实战避坑清单",
        outline: [
          "常识误区：为什么勤奋反而带来低产出？",
          "本质拆解：拉开差距的关键动力学机制",
          "避坑指南：普通人可立即迁移的 3 步行动闭环",
        ],
      },
      {
        platform: "wechat",
        title: "深度长文：从第一性原理重构个人与业务竞争壁垒",
        hook: "“真正的壁垒不在于占有多少资源，而在于打破常识的非共识洞察。”",
        angle: "破除二元对立框架，系统化推演破局方法论",
        outline: [
          "引子：表面繁荣下的系统性逻辑断层",
          "解构：关键案例支撑与 4 步因果链推导",
          "重塑：超越二元对立的长效发展法则",
        ],
      },
      {
        platform: "general",
        title: "反常识法则：被普遍忽略的底层决定性变量",
        hook: "“一文拆解最具穿透力的思维与商业推演模型。”",
        angle: "本质归因与高阶决策模型迁移",
        outline: [
          "现象观察：传统线性路径为什么正在失效？",
          "因果溯源：隐藏动力学与核心反常识认知",
          "决策跃迁：建立自适应反脆弱系统的操作指南",
        ],
      },
    ],
  };
}
