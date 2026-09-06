import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { getDb } from "./db";
import { getByok, type ByokConfig } from "./settings";

/** 一张笔记知识卡片：整卡内容就是一份 markdown 文档，无分字段 schema */
export interface KnowledgeCard {
  id: string;
  document_id: string;
  content_md: string;
  created_at?: string;
  updated_at?: string;
}

/** 卡片萃取技能在编辑部的工位 id（提示词可在编辑部随时修改，萃取时实时读取） */
export const CARD_EXTRACT_AGENT_ID = "agent_card_extract";

const CARD_EXTRACT_AGENT_NAME = "墨小萃 · 卡片萃取师";
const CARD_EXTRACT_AGENT_PERSONA = "极度克制、讲究实操的卡片萃取师，把文章萃成一张能出货的弹药卡";

/** 卡片提取提示词默认值：首次萃取时写入编辑部（custom_agents），之后以编辑部里的为准 */
export const CARD_EXTRACT_DEFAULT_PROMPT = `你是一位极度克制、讲究实操的卡片萃取师。把用户提供的文章/笔记，提炼成一张可直接用于内容创作的「知识卡片」——不是摘要，而是带判断、能出货的弹药卡。

直接输出一份完整的 Markdown 文档（不要 JSON、不要用代码块包裹），八项结构固定，每节用一级标题（#），标题文字原样保留：

# 一句话观点
> （40-80字，有判断、有锋芒；绝不写成"这篇文章讲了XX重要性"这种无判断转述）

# 适用对象 + 场景
（谁、在什么情况下用得上。如：一个人做自媒体、库里一堆笔记却不知道发什么时）

# 三个支撑
**数据**　……
**亲历 · 案例**　……
**反例 · 边界**　……

# 一个最小行动
（读者看完立刻能做、5-15分钟完成的具体一步；"建立知识体系"太虚，"今天把1条旧笔记按四问填完"才算）

# 可复用形态
**长文段落**　半句切入点
**清单**　半句切入点

# 来源与可信度
《来源笔记名或链接》 · 可信度：亲历|二手|待验证

# 一句话自检
- ✓/✗ 有亲手细节
- ✓/✗ 换平台还能讲
- ✓/✗ 现在能发或只差一点

# 金句 / 钩子
> （一句可当标题或开场的话；没有就只写：无）

要求：三个支撑至少覆盖数据/亲历案例/反例(边界)三类的两类；可复用形态列出 2-4 种并各写半句切入点；正文可用 **加粗**、列表、引用、代码块等 Markdown 语法自由排版；除这份文档本身外，不要输出任何解释性文字。`;

/**
 * 读取卡片提取提示词：编辑部（custom_agents）中「卡片萃取师」工位的 system_prompt。
 * 工位不存在时自动按默认值补种；用户在编辑部改过提示词则以改后的为准。
 */
function getCardSystemPrompt(db: ReturnType<typeof getDb>): string {
  db.prepare(
    `INSERT OR IGNORE INTO custom_agents (id, stage, name, persona, system_prompt, model, temperature, is_preset)
     VALUES (?, 'extract', ?, ?, ?, NULL, 0.4, 1)`
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

/** 未配置 AI 或调用失败时的兜底卡片（同样是一份 markdown 文档） */
function generateFallbackCardMd(content: string): string {
  const firstLine =
    content
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.replace(/^#+\s*/, "").length > 10) || "一条待萃取的笔记";
  const plain = firstLine.replace(/^#+\s*/, "").replace(/^\s*[-*>]\s*/, "");

  return `# 一句话观点
> 「${plain.slice(0, 30)}」——真正的价值不在于记录，而在于能否被调用并化作可见的产出。

# 适用对象 + 场景
常在知识库里囤积素材、关键时刻却调用不出来的人。

# 三个支撑
**数据**　文中给出的核心观点与案例，可作为后续写作用的证据点待验证。
**亲历 · 案例**　这条笔记本身即一次亲历的知识管理实践记录。
**反例 · 边界**　若不主动加工与再表达，收藏只会沦为数字仓鼠症的错误等价物。

# 一个最小行动
今天挑出这一条笔记，按一句话观点 + 适用场景重新表述，并写出一个最小行动。

# 可复用形态
**长文段落**　作为文章开头反直觉观点的引子
**清单**　提炼成 3 条的「别再这样整理」避坑清单
**口播**　作为短视频开场的钩子句

# 来源与可信度
《${plain.slice(0, 40) || "当前笔记"}》 · 可信度：待验证

# 一句话自检
- ✗ 有亲手细节
- ✗ 换平台还能讲
- ✗ 现在能发或只差一点

# 金句 / 钩子
> 知识管理的目标不是记住，而是把原料锻造成作品。`;
}
