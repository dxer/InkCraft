import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { getDb } from "./db";
import { getByok, type ByokConfig } from "./settings";
import type { KnowledgeCard } from "./types";

export type { KnowledgeCard };

/** 卡片萃取技能在编辑部的工位 id（提示词可在编辑部随时修改，萃取时实时读取） */
export const CARD_EXTRACT_AGENT_ID = "agent_card_extract";

const CARD_EXTRACT_AGENT_NAME = "墨小萃 · 知识卡片萃取师";
const CARD_EXTRACT_AGENT_PERSONA = "顶尖的认知提纯与知识卡片萃取专家，擅长从长文中提取极具反常识张力与二次创作价值的核心洞察、边界、零件与破题金句";

/** 卡片提取提示词默认值：首次萃取时写入编辑部（custom_agents），之后以编辑部里的为准 */
export const CARD_EXTRACT_DEFAULT_PROMPT = `你是顶尖的知识卡片萃取专家与认知提纯师。
你的任务是将输入的笔记资料压缩提纯为一张【极具二次创作价值与思想穿透力】的原子知识卡片。

工作准则：
1. 拒绝平庸的事实陈述（如“本文介绍了某某方法”），只提取具有反常识张力、底层逻辑突破或深层行动启发的「硬核洞察」；
2. 严禁凭空胡编数据或套话，所有判断与零件依据必须忠实源于原文，但提炼必须锋利、一针见血；
3. 输出纯粹的 Markdown 结构，不要输出任何额外的开头问候或思考过程。

输出格式（严格采用以下 6 个结构化二级标题）：

## 核心洞察
（一句最具穿透力与认知增量的底层判断，不超过 35 字，保留限定条件，直击事物本质）

## 认知张力
- 惯性误区：（90%的人常犯的浅层做法或认知盲区；不超过 30 字）
- 破局逻辑：（原文给出的核心反思与正确解法；不超过 30 字）

## 边界与约束
- 适用：（在何种情境、对谁或满足什么前置条件时成立；不超过 30 字）
- 反适用：（何种场景下会用错或失效；不超过 30 字）

## 硬核零件
（1～2 条关键论据、数据或生动隐喻。每条一行结论 + 一行原文短引依据）
- 论据：……
  依据：「……」

## 破题切口
（一句极具冲突感与吸引力的破题金句或设问，可直接作为下一篇文章开头第一行；不超过 35 字）

## 截图级金句
（提炼原文中最具穿透力、最适合读者截图保存或加粗分享的一句话；没有则写「原文未提供」）`;

export { parseCardFields } from "./card-md";

/**
 * 读取卡片提取提示词：编辑部（custom_agents）中「卡片萃取师」工位的 system_prompt。
 * 工位不存在时自动按默认值补种；用户在编辑部改过提示词则以改后的为准。
 */
function getCardSystemPrompt(db: ReturnType<typeof getDb>): string {
  db.prepare(
    `INSERT INTO custom_agents (id, stage, name, persona, system_prompt, model, temperature, is_preset)
     VALUES (?, 'extract', ?, ?, ?, NULL, 0.4, 1)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       persona = excluded.persona,
       system_prompt = CASE WHEN custom_agents.is_preset = 1 THEN excluded.system_prompt ELSE custom_agents.system_prompt END`
  ).run(CARD_EXTRACT_AGENT_ID, CARD_EXTRACT_AGENT_NAME, CARD_EXTRACT_AGENT_PERSONA, CARD_EXTRACT_DEFAULT_PROMPT);

  const row = db
    .prepare("SELECT system_prompt FROM custom_agents WHERE id = ?")
    .get(CARD_EXTRACT_AGENT_ID) as { system_prompt?: string } | undefined;
  return row?.system_prompt?.trim() || CARD_EXTRACT_DEFAULT_PROMPT;
}

/**
 * 文章入库后 AI 萃取为一张知识卡片：AI 直接产出整份 markdown 文档原样入库。
 * 未配置 AI 或调用失败时，落一张纯文本兜底卡片（同样是完整 markdown）。
 */
export async function extractCardFromDoc(docId: string, content: string): Promise<KnowledgeCard | null> {
  if (!content || content.trim().length < 20) {
    return null;
  }

  const db = getDb();
  let contentMd: string | null = null;

  const cfg = getByok();
  if (cfg) {
    try {
      const clipped =
        content.length > 5000 ? `${content.slice(0, 3000)}\n……\n${content.slice(-2000)}` : content;
      const text = await callLlmText(cfg, getCardSystemPrompt(db), clipped);
      const cleaned = text
        .replace(/^\s*```(?:markdown|md)?\s*\n?/, "")
        .replace(/\n?```\s*$/, "")
        .trim();
      if (cleaned.length > 50) {
        contentMd = cleaned;
      }
    } catch (err) {
      console.warn("[cards] LLM call failed, fallback:", err);
    }
  }
  if (!contentMd) {
    contentMd = generateFallbackCardMd(content);
  }

  db.prepare(`
    INSERT INTO knowledge_cards (id, document_id, content_md, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(document_id) DO UPDATE SET
      content_md = excluded.content_md,
      updated_at = CURRENT_TIMESTAMP
  `).run(randomUUID(), docId, contentMd);

  return getCardForDoc(docId);
}

/** 获取单篇笔记的卡片 */
export function getCardForDoc(docId: string): KnowledgeCard | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id, document_id, content_md, created_at, updated_at FROM knowledge_cards WHERE document_id = ?")
    .get(docId) as KnowledgeCard | undefined;
  return row ?? null;
}

/** 获取全部卡片（带笔记标题，供卡片库画廊用） */
export function getAllCards(): (KnowledgeCard & { note_title: string | null })[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.document_id, c.content_md, c.created_at, c.updated_at,
              ki.title AS note_title
       FROM knowledge_cards c
       JOIN knowledge_items ki ON ki.id = c.document_id
       ORDER BY c.updated_at DESC`
    )
    .all() as (KnowledgeCard & { note_title: string | null })[];
  return rows.map((r) => ({ ...r, note_title: r.note_title ?? null }));
}

/** 入库统计：笔记总数 / 已生成卡片数 */
export function getCardStats(): { total: number; extracted: number } {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) AS n FROM knowledge_items WHERE chunk_index IS NULL").get() as any).n as number;
  const extracted = (db.prepare("SELECT COUNT(*) AS n FROM knowledge_cards").get() as any).n as number;
  return { total, extracted };
}

async function callLlmText(cfg: ByokConfig, system: string, prompt: string): Promise<string> {
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
  return text;
}

/** 未配置 AI 或调用失败时的兜底卡片（同样是一份 markdown 文档，结构与正式卡一致） */
function generateFallbackCardMd(content: string): string {
  const firstLine =
    content
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.replace(/^#+\s*/, "").length > 10) || "一条待萃取的笔记";
  const plain = firstLine.replace(/^#+\s*/, "").replace(/^\s*[-*>]\s*/, "");

  return `## 核心洞察
${plain.slice(0, 35)}

## 认知张力
- 惯性误区：浅层收藏或仅记事实
- 破局逻辑：提炼底层论点并以输出倒逼输入

## 边界与约束
- 适用：通用知识沉淀与二次创作
- 反适用：未提供限定条件时不可盲目推广

## 硬核零件
- 论据：${plain.slice(0, 25)}
  依据：「${plain.slice(0, 30)}」

## 破题切口
如何将「${plain.slice(0, 20)}」转化为高密度的认知产出？

## 截图级金句
「${plain.slice(0, 50)}」`;
}
