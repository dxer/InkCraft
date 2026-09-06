import { NextResponse } from "next/server";
import type Database from "better-sqlite3";
import { getDb } from "@/lib/db";
import { getProjectById } from "@/lib/pipeline";
import { parseCardFields } from "@/lib/card-md";

export const dynamic = "force-dynamic";

/** 召回上限（界面先渲染 12 条，可加载更多） */
const HIT_LIMIT = 24;

export interface RetrieveHit {
  chunkId: string;
  noteId: string;
  noteTitle: string;
  preview: string;
  reason: string;
  score: number;
  isSourceNote: boolean;
  selected: boolean;
}

interface CandidateRow {
  id: string;
  document_id: string;
  title: string | null;
  content: string;
  chunk_index: number | null;
}

/** 把句子切成短语：按标点分句；长句再滑 6 字窗（步长 3），适配 trigram 子串匹配 */
function queryPhrases(q: string): string[] {
  const clauses = q
    .split(/[，。；、！？：\n（）()【】\[\]""「」《》]+/)
    .map((s) => s.trim())
    .filter((s) => Array.from(s).length >= 3);
  const out: string[] = [];
  for (const c of clauses) {
    const len = Array.from(c).length;
    if (len <= 9) {
      out.push(c);
      continue;
    }
    const chars = Array.from(c);
    for (let i = 0; i + 6 <= len; i += 3) {
      out.push(chars.slice(i, i + 6).join(""));
    }
  }
  return Array.from(new Set(out));
}

/** OR 联合 trigram 查询：一次 MATCH 覆盖全部窗口，返回命中的知识条目 id */
function ftsAny(db: Database.Database, phrases: string[], limit: number): string[] {
  const usable = phrases.filter((p) => Array.from(p).length >= 3);
  if (usable.length === 0) return [];
  const match = usable.map((p) => `"${p.replace(/"/g, '""')}"`).join(" OR ");
  try {
    const rows = db
      .prepare(
        `SELECT item_id FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT ${limit}`
      )
      .all(match) as { item_id: string }[];
    return rows.map((r) => r.item_id);
  } catch {
    return [];
  }
}

/** 从查询串中提取数字/百分比分词（「同一数据」信号） */
function numberTerms(q: string): string[] {
  return Array.from(new Set(q.match(/\d+(?:\.\d+)?%?/g) || []));
}

function rankCandidates(
  db: Database.Database,
  project: NonNullable<ReturnType<typeof getProjectById>>,
  sourceNoteId: string | null,
  evidenceQuotes: string[],
  query: string
): RetrieveHit[] {
  const selectedSet = new Set(project.chunkSelection?.map((c) => c.chunkId) || []);

  // 窗口组：短引（强信号 30）与主张（普通信号 10）
  const quoteWindows = Array.from(new Set(evidenceQuotes.flatMap((q) => queryPhrases(q))));
  const claimWindows = Array.from(new Set(queryPhrases(query).filter((w) => !quoteWindows.includes(w))));

  // 1. FTS OR 召回候选 id（短引 + 主张窗口一起查）
  const ids = new Set(ftsAny(db, [...quoteWindows, ...claimWindows], 60));

  // 2. LIKE 降级（FTS 空或异常时）
  if (ids.size === 0 && Array.from(query.trim()).length >= 2) {
    const escaped = query.replace(/[\\%_]/g, (m) => `\\${m}`);
    for (const r of db
      .prepare(
        `SELECT id FROM knowledge_items
         WHERE content LIKE '%' || ? || '%' ESCAPE '\\'
         ORDER BY chunk_index IS NULL DESC, length(content) ASC LIMIT 40`
      )
      .all(escaped) as { id: string }[]) {
      ids.add(r.id);
    }
  }

  // 3. 源笔记与其切片永远进入候选
  if (sourceNoteId) {
    ids.add(sourceNoteId);
    for (const r of db
      .prepare("SELECT id FROM knowledge_items WHERE document_id = ? AND chunk_index IS NOT NULL ORDER BY chunk_index LIMIT 10")
      .all(sourceNoteId) as { id: string }[]) {
      ids.add(r.id);
    }
  }

  if (ids.size === 0) return [];

  // 4. 取回候选行，逐条核对窗口与数字，计算得分与理由
  const placeholders = Array.from(ids).map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT id, document_id, title, content, chunk_index FROM knowledge_items WHERE id IN (${placeholders})`
    )
    .all(...ids) as CandidateRow[];

  const nums = numberTerms(query);
  const hits: RetrieveHit[] = rows.map((c) => {
    const quoteHits = quoteWindows.filter((w) => c.content.includes(w)).length;
    const claimHits = claimWindows.filter((w) => c.content.includes(w)).length;
    const numHits = nums.filter((n) => c.content.includes(n)).length;
    const isSource = !!sourceNoteId && (c.id === sourceNoteId || c.document_id === sourceNoteId);

    let score = 0;
    let reason = "语义相关";
    if (quoteHits > 0) {
      score += 30;
      reason = "短引命中";
    }
    score += Math.min(claimHits * 6, 18);
    score += Math.min(numHits * 4, 12);
    if (isSource) {
      score += 15;
      if (reason === "语义相关") reason = "源笔记";
    }
    if (c.chunk_index === null) score += 3; // 整篇笔记略优先于切片
    if (score === 0) score = 1;

    return {
      chunkId: c.id,
      noteId: c.document_id,
      noteTitle: c.title || "未命名笔记",
      preview: c.content.replace(/\s+/g, " ").trim().slice(0, 200),
      reason,
      score,
      isSourceNote: isSource,
      selected: selectedSet.has(c.id),
    };
  });

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, HIT_LIMIT);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 300) : "";

  const project = projectId ? getProjectById(projectId) : null;
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  if (!query) {
    return NextResponse.json({ error: "检索词不能为空" }, { status: 400 });
  }

  const db: Database.Database = getDb();

  // 卡片模式：卡片 → 源笔记 id + 零件依据短引（排序加权与预勾依据）
  let sourceNoteId: string | null = null;
  let evidenceQuotes: string[] = [];
  if (project.cardId) {
    const card = db
      .prepare("SELECT document_id, content_md FROM knowledge_cards WHERE id = ?")
      .get(project.cardId) as { document_id: string; content_md: string } | undefined;
    if (card) {
      sourceNoteId = card.document_id;
      evidenceQuotes = parseCardFields(card.content_md).parts
        .map((p) => p.evidence)
        .filter((e) => Array.from(e).length >= 3);
    }
  }

  const hits = rankCandidates(db, project, sourceNoteId, evidenceQuotes, query);
  return NextResponse.json({ hits, total: hits.length });
}
