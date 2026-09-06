import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { getDb } from "./db";
import { getByok, type ByokConfig } from "./settings";

export interface SproutMaterialMapping {
  documentId: string;
  documentTitle: string;
  excerpt: string;
  mappingRole: string; // 例如 "论据支撑", "反面警示", "同构模型", "实战经验"
}

/** 单个视角引文（金句回响） */
export interface SproutPerspective {
  label: string; // "哲学视角 · 控制的边界"
  quote: string; // 经典引文
  author: string; // 提出者
}

/** 单个发芽：把笔记断言连接到一个具体的外部知识源，叙事化讲透 */
export interface SproutItem {
  title: string; // 有画面感的小标题，如「罗马奴隶的“控制清单”」
  seed: string; // 🌱 种子：叙事段落（人物/实验/著作 + 与笔记原话的深层共鸣）
  aha_moment: string; // ✨ Aha 瞬间：一句可摘抄的点睛金句
  related_doc_ids: string[]; // 该发芽关联的知识库笔记 id（来自 RAG 召回）
}

export interface SproutResult {
  id: string;
  document_id: string;
  opening: string; // 第二人称开场：从笔记内容解读「你今天在寻找什么」
  sprouts: SproutItem[]; // 3~4 个发芽
  quote_echo: {
    original: string; // 笔记金句原话
    perspectives: SproutPerspective[]; // 3 个视角的引文回响
  };
  longform_title: string; // 基于发芽可装配的长文命题
  raw_json?: string;
  created_at?: string;
  updated_at?: string;

  // —— 派生兼容字段：供工坊装配桥与旧数据平滑转换使用 ——
  seed_summary: string;
  material_mappings: SproutMaterialMapping[];
  concept_extension?: string;
  counter_perspective?: string;
  expanded_outline: {
    title: string;
    points: string[];
    takeaway: string;
  };
}

/**
 * 运行「智鉴 (Sprout)」发芽引擎：
 * 以当前笔记为种子，RAG 发散检索全库素材养料，由叙事型思考教练产出
 * 「开场解读 → 多个发芽（种子叙事 + Aha 瞬间）→ 金句回响」的得到大脑式发芽画卷。
 */
export async function runSproutForDoc(
  docId: string,
  content: string
): Promise<SproutResult> {
  const db = getDb();

  // 1. RAG 语义发散检索：召回 5~8 条全库相关/互补切片
  const recalledMaterials = retrieveSproutMaterials(db, docId, content);

  const cfg = getByok();
  let generated: Record<string, unknown> | null = null;

  if (cfg && content.trim().length >= 20) {
    try {
      const clippedSeed = content.length > 3000 ? `${content.slice(0, 2000)}\n……` : content;
      const materialsContext = recalledMaterials.map((m, idx) => ({
        doc_id: m.id,
        title: m.title || "未命名笔记",
        snippet: m.content.slice(0, 300),
      }));

      const prompt = `【用户种子笔记】：\n${clippedSeed}\n\n【知识库召回的相关参考资料（共 ${recalledMaterials.length} 条，doc_id 可在 related_doc_ids 中引用）】：\n${JSON.stringify(
        materialsContext
      )}\n\n请输出合法 JSON 对象：
{
  "opening": "第二人称开场（60~120字）：从这篇笔记的内容与写作动机出发，解读『你今天在寻找什么』，点出笔记背后隐藏的心智张力或真实困惑，像一位懂你的老朋友开口",
  "sprouts": [
    {
      "title": "发芽小标题（8~16字，有画面感，可借典故意象，如『罗马奴隶的“控制清单”』）",
      "seed": "🌱种子叙事（180~280字）：从笔记中一个具体断言/困惑出发，把读者自然带到一个具体的外部知识源——一位思想家、一个经典心理学实验、一本著作、一段历史。写清人名、年代、情节与核心洞见，再回扣笔记原话，说明两者为何深深共鸣。禁止罗列名词，必须讲故事",
      "aha_moment": "✨Aha瞬间（12~30字）：一句可直接摘抄的点睛金句，凝练这个发芽的启示",
      "related_doc_ids": ["与该发芽真实相关的参考资料 doc_id（可为空数组）"]
    }
  ],
  "quote_echo": {
    "original": "笔记中最有金句相的一句原话（尽量原文摘取）",
    "perspectives": [
      { "label": "哲学视角 · 某某", "quote": "该视角最贴题的经典引文", "author": "提出者姓名" },
      { "label": "心理学/科学视角 · 某某", "quote": "...", "author": "..." },
      { "label": "认知科学/商业视角 · 某某", "quote": "...", "author": "..." }
    ],
  },
  "longform_title": "把这 3~4 个发芽编织成长文的选题命题（18~28字，有张力）"
}

要求：
1. sprouts 输出 3~4 个，每个发芽只聚焦一个外部知识源并讲透；相互之间视角异质（哲学/心理学/实验科学/商业史等不重复）；
2. 开场与种子叙事都用温暖的第二/第三人称叙事，具体的名字、年代、实验细节比抽象模型更有力量；
3. 引文必须真实存在或高度可信，宁可用最经典的，不要编造冷僻伪托；
4. related_doc_ids 只引用确实与该发芽相关的参考资料，无关则留空。`;

      generated = await callLlmJsonObject(cfg, SPROUT_SYSTEM_PROMPT, prompt, 90_000);
    } catch (err) {
      console.warn("[sprout] LLM call failed, fallback:", err);
    }
  }

  if (!generated || typeof generated !== "object" || !Array.isArray((generated as any).sprouts)) {
    generated = generateFallbackSprout(content, recalledMaterials);
  }

  const result = buildSproutResult(generated as Record<string, unknown>, docId, content, recalledMaterials);

  const rawJson = JSON.stringify(result);

  // 兼容持久化写入 document_extractions 表
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
    result.id,
    docId,
    result.opening,
    result.sprouts.map((s) => `【${s.title}】\n${s.seed}`).join("\n\n"),
    result.sprouts.map((s) => s.title).join(" -> "),
    result.quote_echo.perspectives.map((p) => `${p.label}：「${p.quote}」—— ${p.author}`).join("\n"),
    JSON.stringify([
      {
        platform: "wechat",
        title: result.longform_title,
        hook: `“${result.quote_echo.original}”`,
        outline: result.sprouts.map((s) => `${s.title}：${s.aha_moment}`),
      },
    ]),
    rawJson
  );

  return result;
}

/** 把 LLM 输出（或兜底 Mock）规范成 SproutResult，并派生工坊装配桥所需的兼容字段 */
function buildSproutResult(
  generated: Record<string, unknown>,
  docId: string,
  content: string,
  recalledMaterials: { id: string; title: string; content: string }[]
): SproutResult {
  const recalledById = new Map(recalledMaterials.map((m) => [m.id, m]));

  const sprouts: SproutItem[] = (Array.isArray(generated.sprouts) ? generated.sprouts : [])
    .map((s: any) => ({
      title: String(s?.title || "一次发芽").trim().slice(0, 40),
      seed: String(s?.seed || "").trim(),
      aha_moment: String(s?.aha_moment || "").trim(),
      related_doc_ids: Array.isArray(s?.related_doc_ids)
        ? s.related_doc_ids.map((id: unknown) => String(id)).filter((id: string) => recalledById.has(id))
        : [],
    }))
    .filter((s: SproutItem) => s.seed.length > 0)
    .slice(0, 4);

  const echoRaw = (generated.quote_echo || {}) as Record<string, unknown>;
  const perspectives: SproutPerspective[] = (Array.isArray(echoRaw.perspectives) ? echoRaw.perspectives : [])
    .map((p: any) => ({
      label: String(p?.label || "视角").trim().slice(0, 30),
      quote: String(p?.quote || "").trim(),
      author: String(p?.author || "").trim(),
    }))
    .filter((p: SproutPerspective) => p.quote.length > 0)
    .slice(0, 4);

  const firstLine = content.split("\n").find((l) => l.trim().length > 10) || "";
  const originalQuote = String(echoRaw.original || firstLine.replace(/^#+\s*/, "")).trim().slice(0, 120);
  const opening = String(generated.opening || "").trim();
  const longformTitle = String(generated.longform_title || "").trim() || `从「${firstLine.slice(0, 14)}」出发的三重发芽`;

  // 素材映射：优先显式映射，其次按发芽的 related_doc_ids 汇总，最后兜底召回切片
  let materialMappings: SproutMaterialMapping[] = [];
  if (Array.isArray(generated.material_mappings)) {
    for (const m of generated.material_mappings as any[]) {
      if (m && typeof m === "object" && recalledById.has(String(m.doc_id || m.documentId))) {
        materialMappings.push({
          documentId: String(m.doc_id || m.documentId),
          documentTitle: String(m.title || recalledById.get(String(m.doc_id || m.documentId))?.title || "知识库切片"),
          excerpt: String(m.excerpt || recalledById.get(String(m.doc_id || m.documentId))?.content || "").trim().slice(0, 300),
          mappingRole: String(m.mapping_role || m.mappingRole || "论据支撑"),
        });
      }
    }
  }
  if (materialMappings.length === 0) {
    const seen = new Set<string>();
    for (const s of sprouts) {
      for (const id of s.related_doc_ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const rm = recalledById.get(id)!;
        materialMappings.push({
          documentId: id,
          documentTitle: rm.title || "知识库笔记",
          excerpt: rm.content.slice(0, 120),
          mappingRole: "发芽关联素材",
        });
      }
    }
  }
  if (materialMappings.length === 0) {
    recalledMaterials.slice(0, 3).forEach((rm) => {
      materialMappings.push({
        documentId: rm.id,
        documentTitle: rm.title || "知识库笔记",
        excerpt: rm.content.slice(0, 120),
        mappingRole: "实战素材映射",
      });
    });
  }

  // 派生兼容字段：工坊装配桥（大纲 = 各发芽标题 + Aha）
  const derivedOutlinePoints = sprouts.map((s) => `${s.title} —— ${s.aha_moment}`);
  const seedSummary = opening.slice(0, 60) || `关于「${firstLine.slice(0, 24)}」的发散发芽`;

  return {
    id: randomUUID(),
    document_id: docId,
    opening: opening || `从这篇笔记出发，你正在寻找把一个模糊直觉讲透的路径。`,
    sprouts,
    quote_echo: { original: originalQuote, perspectives },
    longform_title: longformTitle,
    seed_summary: seedSummary,
    material_mappings: materialMappings,
    concept_extension: sprouts.map((s) => s.seed).join("\n\n") || undefined,
    counter_perspective: perspectives.map((p) => `${p.label}：「${p.quote}」`).join("；") || undefined,
    expanded_outline: {
      title: longformTitle,
      points: derivedOutlinePoints.length > 0 ? derivedOutlinePoints : ["认知重塑：破除直觉偏见", "机理推演：案例与因果链", "实践跃迁：长效执行闭环"],
      takeaway: sprouts[0]?.aha_moment || originalQuote.slice(0, 40) || "真正的壁垒不在单点技巧，而在认知与执行的闭环。",
    },
  };
}

/**
 * 获取笔记的最新智鉴发芽成果（自动平滑转换旧格式数据）
 */
export function getSproutResult(docId: string): SproutResult | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM document_extractions WHERE document_id = ?")
    .get(docId) as any;
  if (!row) return null;

  if (row.raw_json) {
    try {
      const parsed = JSON.parse(row.raw_json);
      if (Array.isArray(parsed.sprouts) || parsed.concept_extension) {
        return normalizeStoredSprout(parsed, row);
      }
    } catch {}
  }

  // 最老格式（无 raw_json）：按萃取列平滑转换
  return normalizeStoredSprout(
    {
      opening: "这颗种子来自更早的一次知识萃取。",
      sprouts: [
        {
          title: "上次萃取的核心延伸",
          seed: row.counter_intuition || "核心概念与底层模型延伸",
          aha_moment: "建立反脆弱执行闭环",
          related_doc_ids: [],
        },
      ],
      quote_echo: {
        original: (row.causal_chain || "").split(/->|→/)[0]?.trim() || "把原料锻造成作品",
        perspectives: [
          {
            label: "萃取视角 · 偏见与盲点",
            quote: row.bias_and_blindspots || "",
            author: "智鉴档案",
          },
        ],
      },
      longform_title: "从灵感到深度长文的框架演进",
      seed_summary: "知识库精粹萃取",
      material_mappings: [
        {
          documentId: row.document_id,
          documentTitle: "当前笔记事实弹药",
          excerpt: row.hardcore_evidence || "",
          mappingRole: "论据支撑",
        },
      ],
      expanded_outline: {
        title: "从灵感到深度长文的框架演进",
        points: (row.causal_chain || "").split(/->|→/).map((p: string) => p.trim()).filter(Boolean),
        takeaway: "建立反脆弱执行闭环",
      },
    },
    row
  );
}

/** 老的 4 维格式（concept_extension 等）平滑转换成新叙事形态 */
function normalizeStoredSprout(parsed: any, row: any): SproutResult {
  if (Array.isArray(parsed.sprouts) && parsed.opening) {
    return {
      ...parsed,
      id: row.id,
      document_id: row.document_id,
      seed_summary: parsed.seed_summary || String(parsed.opening).slice(0, 60),
      material_mappings: parsed.material_mappings || [],
      expanded_outline: parsed.expanded_outline || { title: parsed.longform_title || "发芽装配大纲", points: [], takeaway: "" },
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // v1（4 维卡片）→ 新形态
  const sprouts: SproutItem[] = [];
  if (parsed.concept_extension) {
    sprouts.push({
      title: "核心概念延伸",
      seed: String(parsed.concept_extension),
      aha_moment: parsed.expanded_outline?.takeaway || "",
      related_doc_ids: [],
    });
  }
  if (parsed.counter_perspective) {
    sprouts.push({
      title: "反直觉对照",
      seed: String(parsed.counter_perspective),
      aha_moment: "",
      related_doc_ids: [],
    });
  }

  return {
    id: row.id,
    document_id: row.document_id,
    opening: parsed.seed_summary || "这颗种子来自一次更早的发芽。",
    sprouts: sprouts.length > 0 ? sprouts : [{ title: "上次发芽", seed: "档案数据为旧格式，点击「重新知识发芽」以新样式重新生长。", aha_moment: "", related_doc_ids: [] }],
    quote_echo: {
      original: parsed.expanded_outline?.takeaway || "",
      perspectives: [],
    },
    longform_title: parsed.expanded_outline?.title || "发芽装配大纲",
    seed_summary: parsed.seed_summary || "",
    material_mappings: Array.isArray(parsed.material_mappings) ? parsed.material_mappings : [],
    concept_extension: parsed.concept_extension,
    counter_perspective: parsed.counter_perspective,
    expanded_outline: parsed.expanded_outline || { title: "发芽装配大纲", points: [], takeaway: "" },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * RAG 知识发散检索算法：
 * 提取种子文本的核心实体关键词，利用 SQLite FTS5 全文索引跨库召回 5~8 条相关切片。
 */
function retrieveSproutMaterials(
  db: ReturnType<typeof getDb>,
  seedDocId: string,
  content: string
): { id: string; title: string; content: string }[] {
  const keywords = extractKeywords(content);
  if (keywords.length === 0) {
    // 降级召回最近的 5 条其他笔记
    return db
      .prepare(`
        SELECT id, title, content FROM knowledge_items
        WHERE id != ? AND chunk_index IS NULL AND length(content) > 30
        ORDER BY updated_at DESC LIMIT 6
      `)
      .all(seedDocId) as any[];
  }

  // 构造 FTS5 查询："词A" OR "词B"
  const matchQuery = keywords.map((k) => `"${k.replace(/"/g, '""')}"`).join(" OR ");
  try {
    const ftsRows = db
      .prepare(`
        SELECT ki.id, ki.title, ki.content
        FROM knowledge_items ki
        JOIN knowledge_fts fts ON ki.id = fts.item_id
        WHERE knowledge_fts MATCH ? AND ki.id != ? AND ki.chunk_index IS NULL
        LIMIT 8
      `)
      .all(matchQuery, seedDocId) as { id: string; title: string; content: string }[];

    if (ftsRows.length >= 2) {
      return ftsRows;
    }
  } catch {}

  // 降级 LIKE 搜索
  const likes = keywords.slice(0, 3);
  const whereClauses = likes.map(() => "(ki.content LIKE ? OR ki.title LIKE ?)").join(" OR ");
  const params: string[] = [];
  likes.forEach((k) => {
    params.push(`%${k}%`, `%${k}%`);
  });

  const likeRows = db
    .prepare(`
      SELECT ki.id, ki.title, ki.content
      FROM knowledge_items ki
      WHERE ki.id != ? AND ki.chunk_index IS NULL AND (${whereClauses})
      LIMIT 8
    `)
    .all(seedDocId, ...params) as { id: string; title: string; content: string }[];

  if (likeRows.length > 0) return likeRows;

  // 最终兜底：最近笔记
  return db
    .prepare(`
      SELECT id, title, content FROM knowledge_items
      WHERE id != ? AND chunk_index IS NULL AND length(content) > 30
      ORDER BY updated_at DESC LIMIT 5
    `)
    .all(seedDocId) as any[];
}

function extractKeywords(text: string): string[] {
  const cleaned = text.replace(/[#*`~>\[\]()!]/g, " ");
  const matches = cleaned.match(/[\u4e00-\u9fa5]{2,6}|[a-zA-Z]{3,15}/g) || [];
  const stopWords = new Set(["这个", "那个", "可以", "以及", "通过", "因为", "所以", "如果", "但是", "没有", "进行", "开始", "关于"]);
  const valid = matches.filter((w) => !stopWords.has(w));
  return Array.from(new Set(valid)).slice(0, 6);
}

const SPROUT_SYSTEM_PROMPT = `你是一位叙事型思考教练，风格参照「得到大脑」的知识发芽：
- 善于把用户的一条笔记，接到一个具体的外部知识源上——一位思想家、一个经典实验、一本著作、一段历史——用讲故事的方式讲透它们与笔记原话的深层共鸣；
- 叙事必须具体：人名、年代、实验情节、著作名，胜过一切抽象模型名词；
- 每个发芽凝练成一句可直接摘抄的「Aha 瞬间」金句；
- 视角相互异质，形成哲学/心理学/实验科学/商业等不同学科的回响。
务必只输出合法的单个 JSON 对象。`;

async function callLlmJsonObject(
  cfg: ByokConfig,
  system: string,
  prompt: string,
  timeoutMs = 60_000
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
    abortSignal: AbortSignal.timeout(timeoutMs),
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

function generateFallbackSprout(
  content: string,
  materials: { id: string; title: string; content: string }[]
): Record<string, unknown> {
  const firstLine = content.split("\n").find((l) => l.trim().length > 10) || "一条等待生长的灵感";
  const m1 = materials[0];
  const m2 = materials[1];

  return {
    opening: `从「${firstLine.slice(0, 20)}」这句记录开始，你今天其实在寻找一条把直觉变成洞见的路径——让这个念头不止于被记下，而是被讲透。`,
    sprouts: [
      {
        title: "斯多葛的控制二分法",
        seed: `你在笔记里写下「${firstLine.slice(0, 30)}」，这让人想起两千年前那位身负重镣却拥有最自由灵魂的罗马奴隶——爱比克泰德。他把一切境遇分成两类：你能控制的（判断、行动、态度）与你不能控制的（评价、环境、命运）。困扰我们的从来不是事物本身，而是我们对事物的看法。你这条笔记正是在做同样的切分：找到真正可控的支点。${m1 ? `你的知识库里，《${m1.title || "一篇笔记"}》恰好记录了同构的实践：「${(m1.content || "").slice(0, 80)}」。` : ""}`,
        aha_moment: "真正的自由，是改变你与世界的关系。",
        related_doc_ids: m1 ? [m1.id] : [],
      },
      {
        title: "阿希实验与从众的代价",
        seed: `心理学家所罗门·阿希在 1951 年做过一个震撼实验：让被试比较线段长短，真正的被试只有一人，其余都是「托儿」。当托儿们一致报出明显错误的答案时，75% 的真被试至少一次屈从了群体压力。你笔记里的判断之所以珍贵，是因为它是在「所有人都说黑」的时候，坚持自己看到的白。独立思考不是标新立异，而是敢于相信自己亲眼所见。`,
        aha_moment: "最危险的谎言，是你为了合群而骗自己。",
        related_doc_ids: [],
      },
      {
        title: "园丁与木匠之别",
        seed: `笔记里的思路还暗合心理学家艾莉森·高普尼克的著名隐喻：木匠式思维手握蓝图，执着于把材料雕琢成标准件；园丁式思维只负责松土、浇水、挡风雨，允许植物按天性扎根开花。对待自己的念头也一样——不要急着把它修剪成「正确答案」，先给它土壤，让它在与不同知识的碰撞里自己长成形状。${m2 ? `这一点在《${m2.title || "你的另一篇笔记"}》里也有印证：「${(m2.content || "").slice(0, 80)}」。` : ""}`,
        aha_moment: "爱不是塑造，而是滋养；最好的帮助是让其成为自己。",
        related_doc_ids: m2 ? [m2.id] : [],
      },
    ],
    quote_echo: {
      original: firstLine.slice(0, 80),
      perspectives: [
        { label: "哲学视角 · 控制的边界", quote: "有些事情取决于我们，有些事情不取决于我们，要分清这两者的界限。", author: "爱比克泰德" },
        { label: "存在主义视角 · 自由的重负", quote: "人是生而自由的，却无往不在枷锁之中。", author: "卢梭" },
        { label: "认知科学视角 · 元认知", quote: "元认知是对自己认知过程的思考，是个人引导心智历程的现象。", author: "J.H. Flavell" },
      ],
    },
    longform_title: `从「${firstLine.slice(0, 12)}」到系统洞见的三重发芽`,
    material_mappings: [
      ...(m1 ? [{ doc_id: m1.id, title: m1.title, excerpt: (m1.content || "").slice(0, 100), mapping_role: "同构实践" }] : []),
      ...(m2 ? [{ doc_id: m2.id, title: m2.title, excerpt: (m2.content || "").slice(0, 100), mapping_role: "经验印证" }] : []),
    ],
  };
}
