import type Database from "better-sqlite3";

export interface SearchHit {
  id: string;
  snippet: string | null;
}

/**
 * FTS5 trigram 检索知识库笔记（≥3 字符生效，中文子串可用）。
 * 返回 null 表示应降级（短词或 FTS 异常）；命中按 rank 排序，带 snippet 上下文。
 */
export function ftsSearchNotes(
  db: Database.Database,
  q: string,
  limit = 80,
): SearchHit[] | null {
  if (Array.from(q).length < 3) return null;
  const match = `"${q.replace(/"/g, '""')}"`;
  try {
    return db
      .prepare(
        `SELECT item_id id, snippet(knowledge_fts, 0, '【', '】', '…', 20) snippet
         FROM knowledge_fts WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT ${limit}`,
      )
      .all(match) as SearchHit[];
  } catch {
    return null;
  }
}

/** LIKE 降级检索笔记（内容/标题/标签，转义通配符，无 snippet），仅笔记级条目 */
export function likeSearchNotes(
  db: Database.Database,
  q: string,
  limit = 80,
): SearchHit[] {
  const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
  const rows = db
    .prepare(
      `SELECT id FROM knowledge_items
       WHERE chunk_index IS NULL
         AND (content LIKE '%' || ? || '%' ESCAPE '\\'
           OR title LIKE '%' || ? || '%' ESCAPE '\\'
           OR category LIKE '%' || ? || '%' ESCAPE '\\'
           OR tags LIKE '%' || ? || '%' ESCAPE '\\')
       ORDER BY created_at DESC LIMIT ${limit}`,
    )
    .all(escaped, escaped, escaped, escaped) as { id: string }[];
  return rows.map((r) => ({ id: r.id, snippet: null }));
}

/** 成果（pipeline_projects）FTS5 命中 id 列表（works_fts），短词/异常返回 null */
export function ftsSearchWorks(
  db: Database.Database,
  q: string,
  limit = 15,
): string[] | null {
  if (Array.from(q).length < 3) return null;
  const match = `"${q.replace(/"/g, '""')}"`;
  try {
    const rows = db
      .prepare(
        `SELECT project_id id FROM works_fts WHERE works_fts MATCH ? ORDER BY rank LIMIT ${limit}`,
      )
      .all(match) as { id: string }[];
    return rows.map((r) => r.id);
  } catch {
    return null;
  }
}

/** 成果 LIKE 降级（标题/选题/母稿正文） */
export function likeSearchWorks(
  db: Database.Database,
  q: string,
  limit = 15,
): string[] {
  const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
  const rows = db
    .prepare(
      `SELECT id FROM pipeline_projects
       WHERE title LIKE '%' || ? || '%' ESCAPE '\\'
          OR selected_topic LIKE '%' || ? || '%' ESCAPE '\\'
          OR master_content LIKE '%' || ? || '%' ESCAPE '\\'
       ORDER BY updated_at DESC LIMIT ${limit}`,
    )
    .all(escaped, escaped, escaped) as { id: string }[];
  return rows.map((r) => r.id);
}
