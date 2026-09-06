import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { parseCardFields } from "@/lib/card-md";
import { getAllCards } from "@/lib/cards";
import { getDb } from "@/lib/db";
import { getAgentForStage } from "@/lib/pipeline";
import { getByok } from "@/lib/settings";
import { batchSaveTopicsToRepository } from "@/lib/topics";
import type { PlatformSkillId } from "@/lib/types";

export const dynamic = "force-dynamic";

export interface IdeatedTopic {
  id: string;
  title: string;
  angle: string;
  hook: string;
  targetSkill: PlatformSkillId;
  targetSkillName: string;
  outline: string[];
  matchedCards?: {
    id: string;
    docId: string;
    claim: string;
    noteTitle: string;
  }[];
}

const SKILL_NAME_MAP: Record<PlatformSkillId, string> = {
  wechat: "微信公众号 · 深度叙事",
  xiaohongshu: "小红书笔记 · 痛点爆款",
  zhihu: "知乎回答 · 深度思辨",
  x_thread: "X / 即刻短文 · 极速穿透",
  master: "通用母稿 · 严谨立论",
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const direction = (body?.direction as string)?.trim() || "";
  const preferredSkill = (body?.preferredSkill as PlatformSkillId) || null;

  const db = getDb();
  const allCards = getAllCards();

  // 1. 先把全部卡片提取并结构化
  const allParsedCards = allCards.map((c) => {
    const fields = parseCardFields(c.content_md);
    return {
      id: c.id,
      docId: c.document_id,
      noteTitle: c.note_title || "未命名笔记",
      claim: fields.claim || c.note_title || "",
      boundary: fields.applicable || fields.notApplicable || "",
      cut: fields.cut || "",
      rawMd: c.content_md || "",
    };
  }).filter((c) => Boolean(c.claim));

  // 2. 根据用户输入的 direction 方向关键词，在知识库卡片中进行高关联度匹配与排序
  let selectedCards = allParsedCards;
  if (direction && direction !== "全部知识储备碰撞") {
    const terms = direction
      .split(/[\s,，、/+\-_]+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 2);

    if (terms.length > 0) {
      const scored = allParsedCards.map((c) => {
        let score = 0;
        const titleLower = c.noteTitle.toLowerCase();
        const claimLower = c.claim.toLowerCase();
        const rawLower = c.rawMd.toLowerCase();

        for (const term of terms) {
          if (titleLower.includes(term)) score += 10;
          if (claimLower.includes(term)) score += 8;
          if (rawLower.includes(term)) score += 3;
        }
        return { card: c, score };
      });

      const matched = scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.card);

      if (matched.length > 0) {
        const matchedIds = new Set(matched.map((m) => m.id));
        const remaining = allParsedCards.filter((c) => !matchedIds.has(c.id));
        selectedCards = [...matched, ...remaining];
      }
    }
  }

  // 取最相关的 top 5 张卡片作为输入语料
  const cardCandidates = selectedCards.slice(0, 5).map((c, idx) => ({
    ...c,
    index: idx + 1,
  }));

  // 若卡片库为空，根据方向检索关联笔记补充
  let notesFallback: { title: string; excerpt: string }[] = [];
  if (cardCandidates.length === 0) {
    let rows: { title: string | null; content: string }[] = [];
    if (direction && direction !== "全部知识储备碰撞") {
      const escaped = `%${direction.trim()}%`;
      rows = db.prepare(
        "SELECT title, content FROM knowledge_items WHERE chunk_index IS NULL AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC LIMIT 3"
      ).all(escaped, escaped) as any[];
    }
    if (rows.length === 0) {
      rows = db.prepare(
        "SELECT title, content FROM knowledge_items WHERE chunk_index IS NULL ORDER BY updated_at DESC LIMIT 3"
      ).all() as any[];
    }
    notesFallback = rows.map((r) => ({
      title: r.title || "知识笔记",
      excerpt: r.content.slice(0, 180).replace(/\n/g, " "),
    }));
  }

  const topicAgent = getAgentForStage("topic");
  const cfg = getByok();

  // 获取历史已有选题标题（取最新 20 条注入负向约束，减少 token 负担）
  const existingTitles = (db
    .prepare("SELECT title FROM topic_repository ORDER BY created_at DESC LIMIT 20")
    .all() as Array<{ title: string }>).map((r) => r.title.trim());

  // 兜底选题构建器（用于未配置 LLM 或 LLM 超时异常）
  function buildFallbackTopics(): IdeatedTopic[] {
    const list: IdeatedTopic[] = [];

    if (cardCandidates.length > 0) {
      // 1. 每张卡片 1 个专属选题
      for (let i = 0; i < Math.min(cardCandidates.length, 3); i++) {
        const c = cardCandidates[i];
        const skill: PlatformSkillId = i === 0 ? (preferredSkill || "wechat") : i === 1 ? "zhihu" : "xiaohongshu";
        list.push({
          id: randomUUID(),
          title: `从「${c.claim.slice(0, 24)}」看知识复利：创作者的高效产出法则`,
          angle: `围绕《${c.noteTitle}》的核心主张，拆解如何将这一原子判断转化为高传播力作品。`,
          hook: `很多人以为笔记越多越渊博，直到面对空白光标，才发现上万条收藏根本写不出一句有穿透力的判断。`,
          targetSkill: skill,
          targetSkillName: SKILL_NAME_MAP[skill],
          outline: [
            "一、认知误区：为什么单纯收藏无法沉淀为个人资产",
            "二、核心立论：如何将该原子观点应用到实际场景",
            "三、实战转化：三步走打通从输入到交付的闭环",
          ],
          matchedCards: [
            {
              id: c.id,
              docId: c.docId,
              claim: c.claim,
              noteTitle: c.noteTitle,
            },
          ],
        });
      }

      // 2. 若有多张卡片，追加 1 个跨卡片张力碰撞选题
      if (cardCandidates.length >= 2) {
        const c1 = cardCandidates[0];
        const c2 = cardCandidates[1];
        const skill: PlatformSkillId = preferredSkill || "x_thread";
        list.push({
          id: randomUUID(),
          title: `知识库终局：当「${c1.noteTitle.slice(0, 10)}」与「${c2.noteTitle.slice(0, 10)}」跨界碰撞`,
          angle: `把两张卡片的独立主张进行跨领域张力碰撞，提炼出超越单一维度的全局洞见。`,
          hook: `创新的本质不是凭空造物，而是把不同领域的常识连接在一起，产生新的认知突破。`,
          targetSkill: skill,
          targetSkillName: SKILL_NAME_MAP[skill],
          outline: [
            "1/ 两个维度的表象割裂与底层共通机制",
            "2/ 交叉张力：如何打破单一思维惯性",
            "3/ 新范式落地：跨界融合的行动指南",
          ],
          matchedCards: [
            { id: c1.id, docId: c1.docId, claim: c1.claim, noteTitle: c1.noteTitle },
            { id: c2.id, docId: c2.docId, claim: c2.claim, noteTitle: c2.noteTitle },
          ],
        });
      }
    } else {
      const fallbackTitle = notesFallback[0]?.title || "个人知识管理";
      list.push({
        id: randomUUID(),
        title: `为什么死记笔记是创作者的低效陷阱？——从「${fallbackTitle}」谈起`,
        angle: "直击囤积笔记却无法产出的创作者痛点，主张以输出倒逼输入，将每条笔记当成生产零件。",
        hook: "很多人以为笔记越多越渊博，直到面对空白光标，才发现上万条收藏根本写不出一句有穿透力的判断。",
        targetSkill: preferredSkill || "wechat",
        targetSkillName: SKILL_NAME_MAP[preferredSkill || "wechat"],
        outline: [
          "一、囤积的幻觉：收藏不等于认知，笔记越多反而越焦虑",
          "二、范式转移：把笔记从「仓库死物」重构为「可装配的原子零件」",
          "三、闭环打法：如何用一张观点卡片 10 分钟跑通多平台出稿",
        ],
        matchedCards: [],
      });
    }

    return list;
  }

  if (!cfg) {
    const mockTopics = buildFallbackTopics();
    try {
      batchSaveTopicsToRepository(
        mockTopics.map((t) => ({
          title: t.title,
          angle: t.angle,
          hook: t.hook,
          targetSkill: t.targetSkill,
          outline: t.outline,
          matchedCards: t.matchedCards,
          sourceType: "manual",
          status: "idea",
        }))
      );
    } catch {}

    return NextResponse.json({ topics: mockTopics, isMock: true });
  }

  try {
    const provider = createOpenAICompatible({
      name: "inkcraft",
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });

    const knowledgePrompt = cardCandidates.length > 0
      ? `【创作者知识库中的核心卡片立论】：\n` +
        cardCandidates
          .map((c) => `[卡片 ${c.index}] 来源：《${c.noteTitle}》\n  核心主张：${c.claim}\n  边界/切口：${c.boundary || c.cut || "通用"}`)
          .join("\n\n")
      : `【创作者知识库笔记摘要】：\n` +
        notesFallback.map((n, i) => `[笔记 ${i + 1}] 《${n.title}》：${n.excerpt}`).join("\n\n");

    const existingConstraint = existingTitles.length > 0
      ? `\n【历史已存在的选题库（严禁重复或高度雷同！）】：\n${existingTitles.slice(0, 40).map((t, i) => `${i + 1}. ${t}`).join("\n")}`
      : "";

    const systemPrompt =
      topicAgent?.system_prompt ||
      `你是顶级内容策划总监与爆款选题大师。
你的任务是深入理解创作者提供的知识库卡片观点，策划 3~4 个极具传播力、痛点共鸣与洞察深度的精益选题方案。

严格遵循两大收敛原则（拒绝单卡片泛滥衍生，注重跨卡片张力碰撞）：
1. 【单卡片一对一】：严禁针对同一张卡片反复生成多个换汤不换药的同质化选题；每张卡片至多产出 1 个最适配该卡片特质的黄金选题；
2. 【跨卡片交叉碰撞】：积极从不同卡片中寻找观点的互补、矛盾或反常识张力，合成 1~2 个【跨界融合大选题】；
3. 【绝对去重】：禁止与历史已有的选题库标题重复；
4. 严格输出 JSON 格式，禁止包含多余说明。`;

    const userPrompt = [
      direction ? `【创作者指定的选题方向/领域】：${direction}` : "【创作者未指定方向，请基于知识库储备自由碰撞出最具爆款潜质的选题】",
      preferredSkill ? `【优先偏好的目标平台技能】：${preferredSkill}` : "【请根据选题性质自主匹配最合适的平台技能】",
      knowledgePrompt,
      existingConstraint,
      `\n请输出包含 3~4 个精益选题方案的 JSON 数组（单卡片专属选题 + 跨卡片碰撞选题），格式严格如下：
[
  {
    "title": "爆款标题（例：《为什么死记笔记是知识分子的低效陷阱？》）",
    "angle": "核心切入角度与论证观点（1-2句清晰陈述）",
    "hook": "正文开头第一段的吸睛引子/冲突破题句",
    "targetSkill": "wechat | xiaohongshu | zhihu | x_thread | master",
    "outline": [
      "一、小标题1（包含递进逻辑）",
      "二、小标题2",
      "三、小标题3"
    ],
    "cardIndices": [1, 2] // 本选题关联/引用的卡片序号 (1-based index)
  }
]`,
    ].join("\n\n");

    let text = "";
    try {
      const response = await generateText({
        model: provider.chatModel(topicAgent?.model || cfg.model),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: topicAgent?.temperature || 0.85,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(120_000),
      });
      text = response.text;
    } catch (llmErr) {
      console.warn("[ideate] LLM call failed or timed out, falling back to local synthesis:", llmErr);
      const fallbackTopics = buildFallbackTopics();
      try {
        batchSaveTopicsToRepository(
          fallbackTopics.map((t) => ({
            title: t.title,
            angle: t.angle,
            hook: t.hook,
            targetSkill: t.targetSkill,
            outline: t.outline,
            matchedCards: t.matchedCards,
            sourceType: "manual",
            status: "idea",
          }))
        );
      } catch {}
      return NextResponse.json({
        topics: fallbackTopics,
        isMock: true,
        notice: "大模型响应超时，系统已自动基于知识卡片立论为你智能策划备用选题",
      });
    }

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end > start) {
      const rawTopics = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(rawTopics)) {
        const topics: IdeatedTopic[] = rawTopics.map((t: any) => {
          const skill: PlatformSkillId =
            ["wechat", "xiaohongshu", "zhihu", "x_thread", "master"].includes(t.targetSkill)
              ? t.targetSkill
              : preferredSkill || "wechat";

          const cardIdxs: number[] = Array.isArray(t.cardIndices) ? t.cardIndices : [];
          const matched = cardIdxs
            .map((idx) => cardCandidates[idx - 1])
            .filter(Boolean)
            .map((c) => ({
              id: c.id,
              docId: c.docId,
              claim: c.claim,
              noteTitle: c.noteTitle,
            }));

          return {
            id: randomUUID(),
            title: String(t.title || "未命名精选选题").trim(),
            angle: String(t.angle || "").trim(),
            hook: String(t.hook || "").trim(),
            targetSkill: skill,
            targetSkillName: SKILL_NAME_MAP[skill] || "平台创作",
            outline: Array.isArray(t.outline) ? t.outline.map(String) : [],
            matchedCards: matched.length > 0 ? matched : cardCandidates.slice(0, 2).map((c) => ({
              id: c.id,
              docId: c.docId,
              claim: c.claim,
              noteTitle: c.noteTitle,
            })),
          };
        });

        try {
          batchSaveTopicsToRepository(
            topics.map((t) => ({
              title: t.title,
              angle: t.angle,
              hook: t.hook,
              targetSkill: t.targetSkill,
              outline: t.outline,
              matchedCards: t.matchedCards,
              sourceType: "manual",
              status: "idea",
            }))
          );
        } catch {}

        return NextResponse.json({ topics, isMock: false });
      }
    }

    // JSON 解析失败时的兜底
    const fallbackTopics = buildFallbackTopics();
    return NextResponse.json({ topics: fallbackTopics, isMock: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "智能选题生成失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
