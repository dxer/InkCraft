import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { KnowledgeRow } from "@/lib/mappers";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

export interface CitationItem {
  index: number;
  id: string;
  title: string;
  excerpt: string;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const scope = (body?.scope as "all" | "category" | "kb" | "items") || "all";
  const scopeValue = typeof body?.scopeValue === "string" ? body.scopeValue : "";

  if (!question) {
    return NextResponse.json({ error: "提问内容不能为空" }, { status: 400 });
  }

  const db = getDb();

  // 1. 根据 scope 检索相关切片与笔记
  const relevantChunks = searchChunksForRAG(db, question, scope, scopeValue);

  const citations: CitationItem[] = relevantChunks.slice(0, 4).map((c, i) => ({
    index: i + 1,
    id: c.id,
    title: c.title || `笔记 · ${c.category || "通用"}`,
    excerpt: c.content.slice(0, 150) + (c.content.length > 150 ? "..." : ""),
  }));

  const cfg = getByok();
  if (!cfg || relevantChunks.length === 0) {
    // 模拟问答回退
    const mockAnswer =
      relevantChunks.length > 0
        ? `基于知识库中的资料 [1]，关于「${question}」，核心观点认为：内容生产的本质是将零散闪念与文献通过确定性的工序锻造成母稿作品 [2]。知识库的真正价值在于原料被调用与装配的频率，而非被动囤积。`
        : `知识库中暂未检索到与「${question}」直接相关的具体笔记。建议在上方速记框随时记录灵感或导入相关主题文献。`;

    return NextResponse.json({
      answer: mockAnswer,
      citations: relevantChunks.length > 0 ? citations : [],
      isMock: true,
    });
  }

  try {
    const provider = createOpenAICompatible({
      name: "inkcraft",
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });

    const contextText = relevantChunks
      .slice(0, 5)
      .map((c, i) => `[引用 ${i + 1}] 标题: ${c.title || "笔记"}\n内容: ${c.content}`)
      .join("\n\n---\n\n");

    const system = [
      "你是墨匠知识库的问答助手。请基于提供的知识库切片资料严谨回答用户的问题。",
      "在陈述观点或事实时，必须在对应句子末尾明确标注引用角标，格式为 [1]、[2] 等，与提供的资料编号严格对应。",
      "回答要简洁有力、提炼要点，杜绝虚构知识库未提及的事实。",
    ].join("\n");

    const prompt = `【知识库相关笔记参考】：\n${contextText}\n\n【用户问题】：${question}`;

    const { text } = await generateText({
      model: provider.chatModel(cfg.model),
      system,
      prompt,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(60_000),
    });

    return NextResponse.json({
      answer: text.trim(),
      citations,
      isMock: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "问答生成失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

function searchChunksForRAG(
  db: ReturnType<typeof getDb>,
  query: string,
  scope: "all" | "category" | "kb" | "items",
  scopeValue?: string
): KnowledgeRow[] {
  const keywords = query
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 4);

  let whereClause = "chunk_index IS NULL";
  const params: unknown[] = [];

  if (scope === "kb" && scopeValue && scopeValue !== "all") {
    whereClause += " AND COALESCE(kb_id, 'default') = ?";
    params.push(scopeValue);
  } else if (scope === "category" && scopeValue) {
    whereClause += " AND category = ?";
    params.push(scopeValue);
  }

  if (keywords.length > 0) {
    const ftsQuery = keywords.map((k) => `"${k}"`).join(" OR ");
    try {
      const rows = db
        .prepare(
          `SELECT ki.* FROM knowledge_items ki
           JOIN knowledge_fts fts ON ki.id = fts.item_id
           WHERE knowledge_fts MATCH ? AND ${whereClause}
           LIMIT 6`
        )
        .all(ftsQuery, ...params) as KnowledgeRow[];
      if (rows.length > 0) return rows;
    } catch {}
  }

  return db
    .prepare(`SELECT * FROM knowledge_items WHERE ${whereClause} ORDER BY created_at DESC LIMIT 6`)
    .all(...params) as KnowledgeRow[];
}
