import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { getDb } from "./db";
import { getByok, type ByokConfig } from "./settings";

/** 单个支撑论据：数据 / 亲历案例 / 反例·边界 三类 */
export interface CardSupport {
  type: "data" | "case" | "counter";
  text: string;
}

/** 可复用形态：长文段落 / 清单 / 口播 / 金句图，各带半句切入点 */
export interface CardReusable {
  type: string; // "长文段落" | "清单" | "口播" | "金句图"
  angle: string; // 半句切入点
}

/** 自检三问打勾 */
export interface CardSelfCheck {
  hasDetail: boolean; // 有亲手细节？
  portable: boolean; // 换平台还能讲？
  readyToPublish: boolean; // 现在能发还是缺什么
}

/** 一张笔记知识卡片（八项结构） */
export interface KnowledgeCard {
  id: string;
  document_id: string;
  one_liner: string; // 1. 一句话观点（灵魂）
  audience: string; // 2. 适用对象 + 场景
  supports: CardSupport[]; // 3. 三个支撑
  min_action: string; // 4. 一个最小行动
  reusable: CardReusable[]; // 5. 可复用形态
  source_note: string; // 6. 来源（笔记名/链接）
  credibility: "亲历" | "二手" | "待验证"; // 6. 可信度标记
  self_check: CardSelfCheck; // 7. 一句话自检
  golden_line: string | null; // 8. 金句/钩子
  raw_json?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 文章入库后 AI 萃取为一张八项知识卡片。
 * 生命周期：短内容守卫 → 裁剪 → LLM(八项 JSON) → 失败走 fallback → 归一化 → 落库(ON CONFLICT upsert) → 返回。
 */
export async function extractCardFromDoc(docId: string, content: string): Promise<KnowledgeCard | null> {
  if (!content || content.trim().length < 20) {
    return null;
  }

  const db = getDb();
  let raw: any = null;

  const cfg = getByok();
  if (cfg) {
    try {
      const clipped =
        content.length > 5000 ? `${content.slice(0, 3000)}\n……\n${content.slice(-2000)}` : content;
      raw = await callLlmJsonObject(cfg, CARD_SYSTEM, clipped);
    } catch (err) {
      console.warn("[cards] LLM call failed, fallback:", err);
    }
  }

  if (!raw || typeof raw !== "object") {
    raw = generateFallbackCard(content);
  }

  const card = normalizeCard(raw, docId);
  const rawJson = JSON.stringify(card);

  db.prepare(`
    INSERT INTO knowledge_cards (
      id, document_id, one_liner, audience, supports, min_action, reusable,
      source_note, credibility, self_check, golden_line, raw_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(document_id) DO UPDATE SET
      one_liner = excluded.one_liner,
      audience = excluded.audience,
      supports = excluded.supports,
      min_action = excluded.min_action,
      reusable = excluded.reusable,
      source_note = excluded.source_note,
      credibility = excluded.credibility,
      self_check = excluded.self_check,
      golden_line = excluded.golden_line,
      raw_json = excluded.raw_json,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    card.id,
    docId,
    card.one_liner,
    card.audience,
    JSON.stringify(card.supports),
    card.min_action,
    JSON.stringify(card.reusable),
    card.source_note,
    card.credibility,
    JSON.stringify(card.self_check),
    card.golden_line,
    rawJson
  );

  return { ...card, raw_json: rawJson };
}

/** 获取单篇笔记的卡片 */
export function getCardForDoc(docId: string): KnowledgeCard | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM knowledge_cards WHERE document_id = ?").get(docId) as any;
  return row ? mapCard(row) : null;
}

/** 获取全部卡片（带笔记标题/更新时间，供卡片库画廊用） */
export function getAllCards(): (KnowledgeCard & { note_title: string | null; updated_at: string })[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*, ki.title AS note_title, ki.updated_at AS note_updated_at
       FROM knowledge_cards c
       JOIN knowledge_items ki ON ki.id = c.document_id
       ORDER BY c.updated_at DESC`
    )
    .all() as any[];
  return rows.map((r) => ({ ...mapCard(r), note_title: r.note_title ?? null, updated_at: r.note_updated_at ?? r.updated_at }));
}

/** 入库统计：笔记总数 / 已生成卡片数 */
export function getCardStats(): { total: number; extracted: number } {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) AS n FROM knowledge_items WHERE chunk_index IS NULL").get() as any).n as number;
  const extracted = (db.prepare("SELECT COUNT(*) AS n FROM knowledge_cards").get() as any).n as number;
  return { total, extracted };
}

async function callLlmJsonObject(
  cfg: ByokConfig,
  system: string,
  prompt: string
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

function mapCard(row: any): KnowledgeCard {
  const supports: CardSupport[] = Array.isArray(row.supports)
    ? row.supports
    : safeParseJson<CardSupport[]>(row.supports, []);
  const reusable: CardReusable[] = Array.isArray(row.reusable)
    ? row.reusable
    : safeParseJson<CardReusable[]>(row.reusable, []);
  const self_check: CardSelfCheck =
    typeof row.self_check === "object" && row.self_check !== null
      ? row.self_check
      : safeParseJson<CardSelfCheck>(row.self_check, { hasDetail: false, portable: false, readyToPublish: false });

  return {
    id: row.id,
    document_id: row.document_id,
    one_liner: row.one_liner || "",
    audience: row.audience || "",
    supports,
    min_action: row.min_action || "",
    reusable,
    source_note: row.source_note || "",
    credibility: ["亲历", "二手", "待验证"].includes(row.credibility) ? row.credibility : "待验证",
    self_check,
    golden_line: row.golden_line || null,
    raw_json: row.raw_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function safeParseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function normalizeCard(raw: any, docId: string): Omit<KnowledgeCard, "raw_json" | "created_at" | "updated_at"> {
  const supports: CardSupport[] = Array.isArray(raw.supports)
    ? raw.supports
        .map((s: any) => (typeof s === "string" ? { type: "data" as const, text: s } : s))
        .filter((s: any) => s && typeof s.text === "string" && s.text.trim())
        .slice(0, 3)
    : [];
  if (supports.length === 0) {
    supports.push({ type: "data", text: "文中观点暂缺具体数据支撑，属待验证启发。" });
  }

  const reusable: CardReusable[] = Array.isArray(raw.reusable)
    ? raw.reusable
        .map((r: any) => (typeof r === "string" ? { type: r, angle: "" } : r))
        .filter((r: any) => r && r.type)
        .slice(0, 4)
    : [{ type: "长文段落", angle: "" }];

  const credibility = ["亲历", "二手", "待验证"].includes(raw.credibility) ? raw.credibility : "待验证";

  const self_check: CardSelfCheck =
    raw.self_check && typeof raw.self_check === "object"
      ? {
          hasDetail: !!raw.self_check.has_detail,
          portable: !!raw.self_check.portable,
          readyToPublish: !!raw.self_check.ready_to_publish,
        }
      : { hasDetail: false, portable: false, readyToPublish: false };

  return {
    id: randomUUID(),
    document_id: docId,
    one_liner: String(raw.one_liner || "").trim().slice(0, 120) || "知识库不加工，就只是收藏夹。",
    audience: String(raw.audience || "").trim().slice(0, 200) || "适合机会一到就需要把观点讲清楚的人。",
    supports,
    min_action: String(raw.min_action || "").trim().slice(0, 200) || "把本条观点按八项填完整。",
    reusable,
    source_note: String(raw.source_note || "").trim().slice(0, 120) || "当前笔记",
    credibility,
    self_check,
    golden_line: raw.golden_line ? String(raw.golden_line).trim().slice(0, 120) : null,
  };
}

function generateFallbackCard(content: string): Record<string, unknown> {
  const firstLine = content.split("\n").find((l) => l.trim().length > 10) || "一条待萃取的笔记";
  return {
    one_liner: `「${firstLine.slice(0, 30)}」——真正的价值不在于记录，而在于能否被调用并化作可见的产出。`,
    audience: "常在知识库里囤积素材、关键时刻却调用不出来的人。",
    supports: [
      { type: "data", text: "文中给出的核心观点与案例，可作为后续写作用的证据点待验证。" },
      { type: "case", text: "这条笔记本身即一次亲历的知识管理实践记录。" },
      { type: "counter", text: "若不主动加工与再表达，收藏只会沦为数字仓鼠症的错误等价物。" },
    ],
    min_action: "今天挑出这一条笔记，按一句话观点 + 适用场景重新表述，并写出一个最小行动。",
    reusable: [
      { type: "长文段落", angle: "作为文章开头反直觉观点的引子" },
      { type: "清单", angle: "提炼成 3 条的「别再这样整理」避坑清单" },
      { type: "口播", angle: "作为短视频开场的钩子句" },
    ],
    source_note: firstLine.slice(0, 40) || "当前笔记",
    credibility: "待验证",
    self_check: { has_detail: false, portable: false, ready_to_publish: false },
    golden_line: "知识管理的目标不是记住，而是把原料锻造成作品。",
  };
}

const CARD_SYSTEM = `你是一位极度克制、讲究实操的卡片萃取师。把用户提供的文章/笔记，提炼成一张可直接用于内容创作的「知识卡片」——不是摘要，而是带判断、能出货的弹药卡。
严格八项，输出合法 JSON：
{
  "one_liner": "一句话观点（灵魂卡）：用自己的话说，40-80字，必须有判断、有锋芒；绝不写成'这篇文章讲了XX重要性'这种无判断转述",
  "audience": "适用对象+场景：谁、在什么情况下用得上。如：一个人做自媒体、库里一堆笔记却不知道发什么时",
  "supports": [{ "type": "data|case|counter", "text": "支撑内容" }, ...] ,
  "min_action": "一个最小行动：读者看完立刻能做、5-15分钟完成的具体一步；'建立知识体系'太虚，'今天把1条旧笔记按四问填完'才算",
  "reusable": [{ "type": "长文段落|清单|口播|金句图", "angle": "半句切入点，如'作为文章开头反直觉观点的引子'" }],
  "source_note": "来源链接或笔记名",
  "credibility": "亲历|二手|待验证",
  "self_check": { "has_detail": true/false, "portable": true/false, "ready_to_publish": true/false },
  "golden_line": "一句可当标题或开场的话；没有就留空字符串"
}
要求：supports 共三个，至少覆盖数据/亲历案例/反例(边界)三类的两类；reusable 列出 2-4 种形态并各写半句切入点；金句没有就空字符串。`;