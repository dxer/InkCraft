import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { KnowledgeRow } from "@/lib/mappers";
import { getAgentForStage } from "@/lib/pipeline";
import { likeSearchNotes } from "@/lib/search";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

export interface EvidenceItem {
  id: string;
  itemId: string;
  title: string;
  excerpt: string;
  reason: string;
  category: string;
}

interface RawCandidate {
  itemId: string;
  title: string;
  excerpt: string;
  reason: string;
  category?: string;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const selectedTopic = body?.selectedTopic;

  if (!selectedTopic?.title) {
    return NextResponse.json({ error: "缺少选定选题信息" }, { status: 400 });
  }

  const db = getDb();
  const agent = getAgentForStage("evidence");

  // 1. 从知识库中进行多关键词 FTS/LIKE 检索候选素材
  const keywords = extractKeywords(
    selectedTopic.title + " " + (selectedTopic.outline || []).join(" "),
  );
  const candidateRows = searchCandidates(db, keywords);

  const cfg = getByok();
  if (!cfg || candidateRows.length === 0) {
    // 候选回退生成
    const mockEvidence: EvidenceItem[] = candidateRows
      .slice(0, 5)
      .map((r, i) => ({
        id: `ev_${i + 1}`,
        itemId: r.id,
        title: r.title || `切片资料 · ${r.category || "通用"}`,
        excerpt:
          r.content.slice(0, 180) + (r.content.length > 180 ? "..." : ""),
        reason: `与当前章节「${selectedTopic.outline?.[i % (selectedTopic.outline?.length || 1)] || "论述"}」强相关，可作为核心例证`,
        category: r.category || "通用",
      }));

    if (mockEvidence.length === 0) {
      mockEvidence.push({
        id: "ev_default",
        itemId: "none",
        title: "《论证备忘录示例条目》",
        excerpt:
          "知识库中暂未检索到高度相关的切片，建议在上方速记框随时补录闪念或导入相关文献。",
        reason: "论证备忘录建议补充论据",
        category: "通用",
      });
    }

    return NextResponse.json({ evidence: mockEvidence, isMock: true });
  }

  try {
    const provider = createOpenAICompatible({
      name: "inkcraft",
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });

    const candidatesText = candidateRows
      .slice(0, 8)
      .map(
        (r, i) =>
          `[条目ID: ${r.id}] 序号${i + 1} 标题/分类: ${r.title || "未命名"} (${r.category || "通用"})\n内容: ${r.content.slice(0, 300)}`,
      )
      .join("\n\n---\n\n");

    const userPrompt = [
      `【选定选题命题】：${selectedTopic.title}`,
      `【选题切入点】：${selectedTopic.angle || ""}`,
      `【章节骨架】：\n${(selectedTopic.outline || []).join("\n")}`,
      `\n【知识库候选切片】：\n${candidatesText}`,
      "\n请筛选并组织出一份《论证备忘录》，挑选 3-6 个最契合各章节论证的切片，输出 JSON 数组，格式：",
      `[
        {
          "itemId": "切片的实际条目ID",
          "title": "条目标题",
          "excerpt": "摘录核心论点或金句（不超过100字）",
          "reason": "推荐理由：具体可支撑哪个章节的什么论点",
          "category": "分类"
        }
      ]`,
    ].join("\n\n");

    const { text } = await generateText({
      model: provider.chatModel(agent?.model || cfg.model),
      system:
        agent?.system_prompt ||
        "你是严谨的资料研究员，梳理论证备忘录并精准关联切片。",
      prompt: userPrompt,
      temperature: agent?.temperature || 0.5,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(60_000),
    });

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end > start) {
      const parsed: RawCandidate[] = JSON.parse(text.slice(start, end + 1));
      const formatted: EvidenceItem[] = parsed.map((item, i) => ({
        id: `ev_${i}_${item.itemId}`,
        itemId: item.itemId,
        title: item.title,
        excerpt: item.excerpt,
        reason: item.reason,
        category: item.category || "通用",
      }));
      return NextResponse.json({ evidence: formatted, isMock: false });
    }

    return NextResponse.json({ error: "未能解析备忘录" }, { status: 502 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "素材匹配失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function extractKeywords(text: string): string[] {
  return text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 5);
}

function searchCandidates(
  db: ReturnType<typeof getDb>,
  keywords: string[],
): KnowledgeRow[] {
  if (keywords.length === 0) {
    return db
      .prepare(
        "SELECT * FROM knowledge_items ORDER BY created_at DESC LIMIT 10",
      )
      .all() as KnowledgeRow[];
  }

  const query = keywords.map((k) => `"${k}"`).join(" OR ");
  try {
    const rows = db
      .prepare(
        `SELECT ki.* FROM knowledge_items ki
         JOIN knowledge_fts fts ON ki.id = fts.item_id
         WHERE knowledge_fts MATCH ?
         LIMIT 10`,
      )
      .all(query) as KnowledgeRow[];
    if (rows.length > 0) return rows;
  } catch {
    // FTS 异常（如非法查询）时降级到 LIKE 分支
  }

  // 降级 LIKE（复用统一检索原语：内容/标题/标签，仅笔记级条目）
  const likeTerm = keywords[0];
  const hits = likeSearchNotes(db, likeTerm, 10);
  if (hits.length === 0) return [];
  return db
    .prepare(
      `SELECT * FROM knowledge_items WHERE id IN (${hits.map(() => "?").join(",")})`,
    )
    .all(...hits.map((h) => h.id)) as KnowledgeRow[];
}
