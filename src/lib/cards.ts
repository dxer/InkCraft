import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import {
  extractFrontmatter,
  splitAndParseDistilledCards,
  parseCardFields,
  type DistilledCard,
  type DistilledFrontmatter,
} from "./card-md";
import { getDb } from "./db";
import { getByok, type ByokConfig } from "./settings";
import type { KnowledgeCard } from "./types";

export type { KnowledgeCard, DistilledCard, DistilledFrontmatter };
export { extractFrontmatter, splitAndParseDistilledCards, parseCardFields };

/** 卡片萃取技能在编辑部的工位 id（提示词可在编辑部随时修改，萃取时实时读取） */
export const CARD_EXTRACT_AGENT_ID = "agent_card_extract";

const CARD_EXTRACT_AGENT_NAME = "墨小萃 · 知识卡片萃取师";
const CARD_EXTRACT_AGENT_PERSONA =
  "顶尖知识架构师兼技术认知学者，精通卢曼卡片盒笔记法与原子永久知识卡片提取，面向自媒体产出具备极强痛点切入点（Hook）的自洽卡片";

/** 卡片提取提示词默认值：首次萃取时写入编辑部（custom_agents），之后以编辑部里的为准 */
export const CARD_EXTRACT_DEFAULT_PROMPT = `你是一名顶级的“知识架构师”兼“技术认知学者”，精通卢曼卡片盒笔记法（Zettelkasten）的原子化哲学与高信息密度知识提炼。

你的任务是：深度剖析用户提供的材料，剥除所有表象修辞、开场白铺垫与空泛口号，将其底层运转机制萃取为 1 到 3 张高信噪比的【原子永久知识卡片（Permanent Notes）】。
【特别原则】：宁缺毋滥。若材料只讲透了一个核心命题，输出 1 张极品卡片即可，严禁为了凑数而强行拆解出同义反复的碎片。

---

### 🚨 绝对禁止项（Negative Constraints - 触发即视为任务失败）
1. **严禁博客导语与系列元信息**：正文与标题绝不可出现“本系列第X篇”、“本文介绍了”、“作者在文中提到”、“敬请期待”、“后续我们将拆解”等导言废话。
2. **严禁万能套话与假大空金句**：严禁出现“通过提炼底层逻辑与输出倒逼输入”、“若缺乏上下文切忌盲目推广”、“提升认知维度”等放在任何领域都能说的无意义套话。
3. **严禁将系统操作当作行动**：落地行动必须针对“该知识领域本身的实操”，严禁输出“在创作工坊展开为成稿”、“保存卡片以便复习”等系统操作废话。
4. **劣质内容拒止机制**：如果输入材料纯粹是【开坑预告、目录提纲、情绪抒发、碎碎念、毫无实质论证机制的引言】，必须判定为无实质干货，直接输出 \`SKIP_EMPTY_SUBSTANCE\`，严禁强行硬凑卡片！

---

### 🎯 永久卡片质量准则
1. **断言式命题标题（Thesis Statement）**：
   - 标题必须是一个具有明确因果、机制或反常识判断的【完整陈述句】。
   - 检验标准：遮住所有正文只看标题，读者必须能明确获得一个“可以被证实或证伪”的客观规律，严禁使用“关于X的前置准备”、“谈谈Y”等宽泛短语。
2. **底层机制透传（Mechanisms over Facts）**：
   - 解释“为什么会这样”的深层因果链条（前提条件 -> 作用机理 -> 必然结果），使用清晰、精准的大白话，揭示事物运转的底层规律。
3. **客观边界与认知陷阱**：
   - 明确指出该规律适用的边界条件（在什么具体场景下会失效？），或者行业大众最常踩的具体认知误区。
4. **传播钩子（Hook）**：
   - 提炼一句话能击中从业者或读者“痛点、认知盲区或反直觉现实”的锋利洞见。
5. **潜在关联概念（Connection Hints）**：
   - 提取 2~3 个可能与之产生【因果推导】、【对立冲突】或【跨学科同构】的已有知识模型名称，辅助知识库建立网状连接。
6. **最小可行落地行动（Actionable Instruction）**：
   - 必须是一条极度具体、带着参数、动作或检验标准的执行指令。

---

### 📦 输出格式规范（机器解析专用，极其重要）
- 输出格式必须是纯粹的 Markdown + YAML Frontmatter。
- **YAML 安全转义规则**：所有 \`title\`、\`hook\` 字段的值**必须用双引号严格包裹**；若值内部含有引号，必须改用单引号（防止破坏 YAML 键值对语法导致程序解析崩溃）。
- 多张卡片之间必须使用严格的三个短横线 \`---\` 独立分割。
- 严禁在最前面或最后面输出任何客套问候语、确认语或说明文字。

#### 标准输出模板与范例：

---
title: "Vibe Coding 的核心杠杆不在代码生成，而在前置软件规范（Spec）的边界锁定"
tags: [VibeCoding, AI编程, 软件工程]
hook: "很多人以为 Vibe Coding 是靠直觉写代码，最后却变成了靠玄学修 Bug"
connection_hints: ["上下文窗口污染", "测试驱动开发(TDD)", "自然语言精确度"]
type: permanent
---

### 核心机制
AI 代码模型本质上是概率推断器，其生成准确度极度依赖上下文边界的收敛程度。若没有前置固化的软件规范（Spec），模型在多轮对话中会因上下文膨胀而产生逻辑漂移，导致架构迅速失控。因此，AI 编程的生产力红利并非来自免去思考，而是将原本消耗在语法细节上的脑力，前置转移到了对业务状态、数据字典与边界条件的精确定义上。

### 适用边界与认知误区
- **失效场景**：单文件极简脚本、一次性探索型 Demo 或无需维护的废弃型代码，过度编写 Spec 反而降低原型验证速度。
- **典型误区**：误把“提示词越口语化、越短”当成高效，忽视了后期修补隐性逻辑漏洞付出的翻倍代价。

### 落地行动
在向 AI 下达代码生成指令前，先建立一份只包含「数据结构 Schema」与「异常状态边界表」的独立 Markdown 规范文件，并强制模型在生成前按此 Spec 确认输入输出。`;

interface CardExtractConfig {
  prompt: string;
  model: string | null;
  temperature: number;
}

/**
 * 读取卡片提取提示词与模型配置：编辑部（custom_agents）中「卡片萃取师」工位。
 * 工位不存在时自动按默认值补种；用户在编辑部改过提示词或模型则以改后的为准。
 */
function getCardExtractConfig(db: ReturnType<typeof getDb>): CardExtractConfig {
  db.prepare(
    `INSERT INTO custom_agents (id, stage, name, persona, system_prompt, model, temperature, is_preset)
     VALUES (?, 'extract', ?, ?, ?, NULL, 0.4, 1)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       persona = excluded.persona,
       system_prompt = CASE WHEN custom_agents.is_preset = 1 THEN excluded.system_prompt ELSE custom_agents.system_prompt END`
  ).run(CARD_EXTRACT_AGENT_ID, CARD_EXTRACT_AGENT_NAME, CARD_EXTRACT_AGENT_PERSONA, CARD_EXTRACT_DEFAULT_PROMPT);

  const row = db
    .prepare("SELECT system_prompt, model, temperature FROM custom_agents WHERE id = ?")
    .get(CARD_EXTRACT_AGENT_ID) as { system_prompt?: string; model?: string | null; temperature?: number } | undefined;

  return {
    prompt: row?.system_prompt?.trim() || CARD_EXTRACT_DEFAULT_PROMPT,
    model: row?.model?.trim() || null,
    temperature: typeof row?.temperature === "number" ? row.temperature : 0.4,
  };
}

/**
 * 文章入库后 AI 蒸馏萃取为 1~3 张原子永久知识卡片。
 * 纯真实提炼机制，绝不伪造任何 Mock 兜底卡片：
 * 1. 门禁检查（过短文本跳过，不浪费 Token）
 * 2. 大上下文无损完整输入（2 万字以内不截断）
 * 3. 严格遵循 Zettelkasten 与负向规则的 LLM 结构化提炼
 * 4. 多卡片精准切分与 Frontmatter 解析
 * 5. 真实卡片批量落库（若模型拒止或调用失败，绝不生成假卡片）
 */
export async function extractCardFromDoc(docId: string, content: string): Promise<KnowledgeCard[]> {
  if (!content || content.trim().length < 15) {
    return [];
  }

  const db = getDb();
  const cfg = getByok();
  if (!cfg) {
    console.warn("[cards] AI not configured, skip distillation for docId:", docId);
    return [];
  }

  let distilledCards: DistilledCard[] = [];

  try {
    // 现代大模型大上下文窗口无损输入：2 万字以内完整送入；超大文本做平滑中段采样
    const inputContent =
      content.length > 20000
        ? `${content.slice(0, 14000)}\n\n……（中间部分略）……\n\n${content.slice(-6000)}`
        : content;

    const extractCfg = getCardExtractConfig(db);
    const text = await callLlmText(
      cfg,
      extractCfg.prompt,
      inputContent,
      extractCfg.model,
      extractCfg.temperature,
    );
    distilledCards = splitAndParseDistilledCards(text);
  } catch (err) {
    console.warn("[cards] LLM card distillation call failed:", err);
    return [];
  }

  // 若模型触发拒止机制（如 SKIP_EMPTY_SUBSTANCE）或未提取出有效卡片，不插入任何假数据
  if (distilledCards.length === 0) {
    console.info(`[cards] docId=${docId} 未提炼出有效原子卡片（材料可能为空洞或触发拒止）`);
    return [];
  }

  // 事务落库：先清理该文档的历史旧卡片，再批量写入本次真实提炼的卡片
  db.transaction(() => {
    db.prepare("DELETE FROM knowledge_cards WHERE document_id = ?").run(docId);

    const insertStmt = db.prepare(`
      INSERT INTO knowledge_cards (id, document_id, content_md, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    for (const card of distilledCards) {
      insertStmt.run(randomUUID(), docId, card.contentMd);
    }

    // 若源笔记尚未设置标签，自动将卡片提炼出的前 1~2 个核心领域标签回写固化到源笔记中，形成受控词表闭环
    const noteRow = db.prepare("SELECT tags, category FROM knowledge_items WHERE id = ?").get(docId) as
      | { tags: string | null; category: string | null }
      | undefined;
    if (noteRow && (!noteRow.tags || noteRow.tags === "[]" || noteRow.tags.trim() === "")) {
      const primaryTags = distilledCards[0]?.frontmatter?.tags?.slice(0, 2) || [];
      if (primaryTags.length > 0) {
        db.prepare("UPDATE knowledge_items SET tags = ? WHERE id = ?").run(
          JSON.stringify(primaryTags),
          docId
        );
      }
    }
  })();

  return getCardsForDoc(docId);
}

/** 获取单篇笔记萃取的全部原子卡片列表 */
export function getCardsForDoc(docId: string): KnowledgeCard[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, document_id, content_md, created_at, updated_at FROM knowledge_cards WHERE document_id = ? ORDER BY created_at ASC")
    .all(docId) as KnowledgeCard[];
  return rows;
}

/** 获取单篇笔记的首张卡片（兼容单卡读取场景） */
export function getCardForDoc(docId: string): KnowledgeCard | null {
  const cards = getCardsForDoc(docId);
  return cards[0] ?? null;
}

/** 获取全部卡片（带笔记标题与笔记受控标签，供卡片库与图谱画廊用） */
export function getAllCards(): (KnowledgeCard & { note_title: string | null; note_tags?: string[] })[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.id, c.document_id, c.content_md, c.created_at, c.updated_at,
              ki.title AS note_title, ki.tags AS note_tags_raw
       FROM knowledge_cards c
       JOIN knowledge_items ki ON ki.id = c.document_id
       ORDER BY c.updated_at DESC, c.created_at ASC`
    )
    .all() as (KnowledgeCard & { note_title: string | null; note_tags_raw: string | null })[];

  return rows.map((r) => {
    let noteTags: string[] = [];
    if (r.note_tags_raw) {
      try {
        const parsed = JSON.parse(r.note_tags_raw);
        if (Array.isArray(parsed)) {
          noteTags = parsed.filter((t): t is string => typeof t === "string" && !!t.trim());
        }
      } catch {
        // 兼容普通逗号分隔形式
        noteTags = r.note_tags_raw
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }
    return {
      ...r,
      note_title: r.note_title ?? null,
      note_tags: noteTags,
    };
  });
}

/** 入库统计：笔记总数 / 已提取卡片的笔记数 */
export function getCardStats(): { total: number; extracted: number } {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) AS n FROM knowledge_items WHERE chunk_index IS NULL").get() as any).n as number;
  const extracted = (db.prepare("SELECT COUNT(DISTINCT document_id) AS n FROM knowledge_cards").get() as any).n as number;
  return { total, extracted };
}

async function callLlmText(
  cfg: ByokConfig,
  system: string,
  prompt: string,
  overrideModel?: string | null,
  temperature = 0.4,
): Promise<string> {
  const provider = createOpenAICompatible({
    name: "inkcraft",
    baseURL: cfg.baseUrl,
    apiKey: cfg.apiKey,
  });
  const modelToUse = overrideModel || cfg.model;
  const { text } = await generateText({
    model: provider.chatModel(modelToUse),
    system,
    prompt,
    temperature,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(300_000), // 超时上限提升至 5 分钟 (300,000ms)，避免深度推理或长文分析超时
  });
  return text;
}
