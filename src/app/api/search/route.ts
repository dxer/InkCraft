import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mapKb, mapNote, type KbRow, type KnowledgeRow } from "@/lib/mappers";
import {
  ftsSearchNotes,
  ftsSearchWorks,
  likeSearchNotes,
  likeSearchWorks,
} from "@/lib/search";
import { markdownLength } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SEARCH_LIMIT = 30;

type Db = ReturnType<typeof getDb>;

export async function GET(request: Request) {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  const q = (url.searchParams.get("q") ?? "").trim();
  const db = getDb();

  // 1. 搜索知识库
  let kbs = [];
  if (q) {
    const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
    const kbRows = db
      .prepare(
        `SELECT kb.*, (SELECT COUNT(*) FROM knowledge_items WHERE COALESCE(kb_id, 'default') = kb.id AND chunk_index IS NULL) as notes_count
         FROM knowledge_bases kb
         WHERE kb.name LIKE '%' || ? || '%' ESCAPE '\\' OR kb.description LIKE '%' || ? || '%' ESCAPE '\\'
         ORDER BY kb.is_default DESC, kb.created_at ASC
         LIMIT 10`,
      )
      .all(escaped, escaped) as KbRow[];
    kbs = kbRows.map(mapKb);
  } else {
    const kbRows = db
      .prepare(
        `SELECT kb.*, (SELECT COUNT(*) FROM knowledge_items WHERE COALESCE(kb_id, 'default') = kb.id AND chunk_index IS NULL) as notes_count
         FROM knowledge_bases kb
         ORDER BY kb.is_default DESC, kb.created_at ASC
         LIMIT 6`,
      )
      .all() as KbRow[];
    kbs = kbRows.map(mapKb);
  }

  // 2. 搜索笔记
  let notes = [];
  if (q) {
    notes = searchNotes(db, q);
  } else {
    const rows = db
      .prepare(
        `SELECT ki.*, kb.name as kb_name 
         FROM knowledge_items ki
         LEFT JOIN knowledge_bases kb ON COALESCE(ki.kb_id, 'default') = kb.id
         WHERE ki.chunk_index IS NULL 
         ORDER BY ki.created_at DESC 
         LIMIT 8`,
      )
      .all() as (KnowledgeRow & { kb_name: string | null })[];
    notes = rows.map((r) => ({
      ...mapNote(r),
      kbName: r.kb_name || "主知识库",
      snippet: null,
    }));
  }

  // 3. 搜索成果 (pipeline_projects)：FTS 全文命中，短词/异常退回 LIKE
  let works = [];
  if (q) {
    const ids = ftsSearchWorks(db, q) ?? likeSearchWorks(db, q);
    let projectRows: {
      id: string;
      title: string;
      current_stage: string;
      master_content: string | null;
      updated_at: string;
    }[] = [];
    if (ids.length > 0) {
      projectRows = db
        .prepare(
          `SELECT id, title, current_stage, master_content, updated_at
           FROM pipeline_projects
           WHERE id IN (${ids.map(() => "?").join(",")})
           ORDER BY updated_at DESC
           LIMIT 15`,
        )
        .all(...ids) as {
        id: string;
        title: string;
        current_stage: string;
        master_content: string | null;
        updated_at: string;
      }[];
    }

    works = projectRows.map((p) => ({
      id: p.id,
      title: p.title,
      currentStage: p.current_stage,
      wordCount: p.master_content ? markdownLength(p.master_content) : 0,
      updatedAt: p.updated_at,
    }));
  } else {
    const projectRows = db
      .prepare(
        `SELECT id, title, current_stage, master_content, updated_at
         FROM pipeline_projects
         ORDER BY updated_at DESC
         LIMIT 6`,
      )
      .all() as {
      id: string;
      title: string;
      current_stage: string;
      master_content: string | null;
      updated_at: string;
    }[];

    works = projectRows.map((p) => ({
      id: p.id,
      title: p.title,
      currentStage: p.current_stage,
      wordCount: p.master_content ? markdownLength(p.master_content) : 0,
      updatedAt: p.updated_at,
    }));
  }

  return NextResponse.json({
    query: q,
    notes,
    kbs,
    works,
    total: notes.length + kbs.length + works.length,
  });
}

function searchNotes(db: Db, q: string) {
  const hits =
    ftsSearchNotes(db, q, SEARCH_LIMIT) ?? likeSearchNotes(db, q, SEARCH_LIMIT);
  if (hits.length === 0) return [];

  const idSet = new Set(hits.map((h) => h.id));
  const rows = db
    .prepare(
      `SELECT ki.*, kb.name as kb_name 
       FROM knowledge_items ki
       LEFT JOIN knowledge_bases kb ON COALESCE(ki.kb_id, 'default') = kb.id
       WHERE ki.id IN (${[...idSet].map(() => "?").join(",")}) AND ki.chunk_index IS NULL`,
    )
    .all(...idSet) as (KnowledgeRow & { kb_name: string | null })[];

  const snippetById = new Map(hits.map((h) => [h.id, h.snippet]));
  return rows.map((r) => ({
    ...mapNote(r),
    kbName: r.kb_name || "主知识库",
    snippet: snippetById.get(r.id) || null,
  }));
}
