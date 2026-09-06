import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "./db";
import type { AgentRow } from "./mappers";
import { normalizePipelineStage } from "./types";
import type { PipelineProject, PipelineStage } from "./types";

export interface ProjectRow {
  id: string;
  title: string;
  current_stage: string;
  target_skill: string | null;
  topic_id?: string | null;
  selected_topic: string | null;
  master_content: string | null;
  card_id: string | null;
  claim_snapshot: string | null;
  brief: string | null;
  snapshots?: string | null;
  updated_at: string;
}

export function getOrCreateActiveProject(): PipelineProject {
  const db = getDb();
  let row = db
    .prepare("SELECT * FROM pipeline_projects ORDER BY updated_at DESC LIMIT 1")
    .get() as ProjectRow | undefined;

  if (!row) {
    const id = randomUUID();
    const title = "未命名装配项目";
    db.prepare(
      "INSERT INTO pipeline_projects (id, title, current_stage, selected_topic, master_content) VALUES (?, ?, 'ideate', NULL, '')"
    ).run(id, title);
    row = db.prepare("SELECT * FROM pipeline_projects WHERE id = ?").get(id) as ProjectRow;
  }

  return mapProjectWithMaterials(db, row);
}

export function getProjectById(id: string): PipelineProject | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM pipeline_projects WHERE id = ?").get(id) as ProjectRow | undefined;
  if (!row) return null;
  return mapProjectWithMaterials(db, row);
}

export function updateProject(
  id: string,
  updates: {
    title?: string;
    currentStage?: PipelineStage;
    targetSkill?: string | null;
    topicId?: string | null;
    selectedTopic?: string | null;
    masterContent?: string | null;
    cardId?: string | null;
    claimSnapshot?: string | null;
    brief?: string | null;
    snapshots?: string | null;
  }
): PipelineProject | null {
  const db = getDb();
  const sets: string[] = ["updated_at = CURRENT_TIMESTAMP"];
  const values: unknown[] = [];

  if (updates.title !== undefined) {
    sets.push("title = ?");
    values.push(updates.title);
  }
  if (updates.currentStage !== undefined) {
    sets.push("current_stage = ?");
    values.push(updates.currentStage);
  }
  if (updates.targetSkill !== undefined) {
    sets.push("target_skill = ?");
    values.push(updates.targetSkill);
  }
  if (updates.topicId !== undefined) {
    sets.push("topic_id = ?");
    values.push(updates.topicId);
  }
  if (updates.selectedTopic !== undefined) {
    sets.push("selected_topic = ?");
    values.push(updates.selectedTopic);
  }
  if (updates.masterContent !== undefined) {
    sets.push("master_content = ?");
    values.push(updates.masterContent);
  }
  if (updates.cardId !== undefined) {
    sets.push("card_id = ?");
    values.push(updates.cardId);
  }
  if (updates.claimSnapshot !== undefined) {
    sets.push("claim_snapshot = ?");
    values.push(updates.claimSnapshot);
  }
  if (updates.brief !== undefined) {
    sets.push("brief = ?");
    values.push(updates.brief);
  }
  if (updates.snapshots !== undefined) {
    sets.push("snapshots = ?");
    values.push(updates.snapshots);
  }

  db.prepare(`UPDATE pipeline_projects SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);

  // 若阶段标记为完成，且关联了选题 ID，自动闭环更新选题库状态为 'used'
  if (updates.currentStage === "completed" || (updates.masterContent && updates.masterContent.trim().length >= 50)) {
    const proj = db.prepare("SELECT topic_id, title FROM pipeline_projects WHERE id = ?").get(id) as { topic_id: string | null; title: string } | undefined;
    if (proj?.topic_id) {
      try {
        db.prepare(
          "UPDATE topic_repository SET status = 'used', used_project_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(id, proj.topic_id);
      } catch {}
    }
  }

  return getProjectById(id);
}

export function attachMaterialsToProject(
  projectId: string,
  itemIds: string[],
  source: "manual" | "evidence" = "manual"
): void {
  const db = getDb();
  // 仅挂载真实存在的笔记（mock 占位 / 已删除的 itemId 直接跳过，避免外键约束失败）
  const insert = db.prepare(
    `INSERT INTO project_materials (id, project_id, item_id, source)
     SELECT ?, ?, ?, ?
     WHERE EXISTS (SELECT 1 FROM knowledge_items WHERE id = ?)
     ON CONFLICT DO NOTHING`
  );
  for (const itemId of itemIds) {
    insert.run(randomUUID(), projectId, itemId, source, itemId);
  }
}

export function removeMaterialFromProject(projectId: string, materialId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM project_materials WHERE id = ? AND project_id = ?").run(materialId, projectId);
}

/** 清空某来源的全部挂载素材（如重新确认论据前先清掉旧 evidence 素材） */
export function clearMaterialsBySource(projectId: string, source: "manual" | "evidence"): void {
  const db = getDb();
  db.prepare("DELETE FROM project_materials WHERE project_id = ? AND source = ?").run(projectId, source);
}

export function getAgentForStage(stage: string): AgentRow | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM custom_agents WHERE stage = ? LIMIT 1").get(stage) as AgentRow) || null;
}

/** 覆盖式保存项目勾选的取证切片（上限 8 条，超出截断） */
export function setProjectChunks(
  projectId: string,
  items: { chunkId: string; packedText?: string | null }[]
): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO project_chunks (id, project_id, chunk_id, packed_text)
     SELECT ?, ?, ?, ?
     WHERE EXISTS (SELECT 1 FROM knowledge_items WHERE id = ?)
     ON CONFLICT(project_id, chunk_id) DO UPDATE SET packed_text = excluded.packed_text`
  );
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM project_chunks WHERE project_id = ?").run(projectId);
    for (const it of items.slice(0, 8)) {
      insert.run(randomUUID(), projectId, it.chunkId, it.packedText ?? null, it.chunkId);
    }
  });
  tx();
}

export function getProjectChunks(projectId: string): { chunkId: string; packedText: string | null }[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT chunk_id AS chunkId, packed_text AS packedText FROM project_chunks WHERE project_id = ? ORDER BY added_at ASC"
    )
    .all(projectId) as { chunkId: string; packedText: string | null }[];
}

/**
 * 清理空白孤儿项目：无选题、无挂载素材、无正文且超过 1 小时未更新的项目直接删除
 * （materials/variants 由外键级联清理），避免每次进入工坊都留下「新装配项目」尸体。
 */
export function pruneEmptyProjects(): void {
  const db = getDb();
  db.prepare(
    `DELETE FROM pipeline_projects
     WHERE selected_topic IS NULL
       AND card_id IS NULL
       AND TRIM(COALESCE(master_content, '')) = ''
       AND updated_at < datetime('now', '-1 hour')
       AND NOT EXISTS (SELECT 1 FROM project_materials pm WHERE pm.project_id = pipeline_projects.id)`
  ).run();
}

const MEMORY_LIMIT = 6;

/**
 * 挑选与选题相关的创作者记忆（个人速记沉淀）：
 * 优先按选题标题 FTS 命中，未命中或短词退回最近记录；已挂载为素材的条目排除，避免重复注入。
 */
export function pickCreatorMemories(
  db: Database.Database,
  topicText: string,
  excludeItemIds: string[]
): { id: string; title: string; content: string }[] {
  const budget = MEMORY_LIMIT + excludeItemIds.length;
  let rows: { id: string; title: string | null; content: string }[] = [];
  const q = topicText.trim().slice(0, 40);

  try {
    if (Array.from(q).length >= 3) {
      const match = `"${q.replace(/"/g, '""')}"`;
      rows = db
        .prepare(
          `SELECT ki.id, ki.title, ki.content
           FROM knowledge_fts f
           JOIN knowledge_items ki ON ki.id = f.item_id
           WHERE knowledge_fts MATCH ? AND ki.chunk_index IS NULL
           ORDER BY rank LIMIT ${budget}`
        )
        .all(match) as { id: string; title: string | null; content: string }[];
    }
  } catch {
    // FTS 不可用时走近期记忆
  }

  if (rows.length === 0) {
    rows = db
      .prepare(
        `SELECT id, title, content FROM knowledge_items
         WHERE chunk_index IS NULL AND LENGTH(content) >= 30
         ORDER BY created_at DESC LIMIT ${budget}`
      )
      .all() as { id: string; title: string | null; content: string }[];
  }

  const excluded = new Set(excludeItemIds);
  return rows
    .filter((r) => !excluded.has(r.id))
    .slice(0, MEMORY_LIMIT)
    .map((r) => ({ id: r.id, title: r.title || "未命名笔记", content: r.content.slice(0, 280) }));
}

function mapProjectWithMaterials(db: ReturnType<typeof getDb>, row: ProjectRow): PipelineProject {
  const materials = db
    .prepare(
      `SELECT pm.id, pm.item_id as itemId, pm.source, ki.title, ki.content
       FROM project_materials pm
       JOIN knowledge_items ki ON pm.item_id = ki.id
       WHERE pm.project_id = ?
       ORDER BY pm.added_at ASC`
    )
    .all(row.id) as {
    id: string;
    itemId: string;
    source: "manual" | "evidence";
    title: string | null;
    content: string;
  }[];

  const variantRows = db
    .prepare("SELECT platform_id, content FROM project_variants WHERE project_id = ?")
    .all(row.id) as { platform_id: string; content: string }[];

  const variants: Record<string, string> = {};
  for (const v of variantRows) variants[v.platform_id] = v.content;

  const chunkSelection = db
    .prepare(
      `SELECT pc.chunk_id AS chunkId, pc.packed_text AS packedText,
              ki.title AS noteTitle, ki.content AS text
       FROM project_chunks pc
       JOIN knowledge_items ki ON ki.id = pc.chunk_id
       WHERE pc.project_id = ?
       ORDER BY pc.added_at ASC`
    )
    .all(row.id) as { chunkId: string; packedText: string | null; noteTitle: string | null; text: string }[];

  let selectedTopic = null;
  if (row.selected_topic) {
    try {
      selectedTopic = JSON.parse(row.selected_topic);
    } catch {
      selectedTopic = null;
    }
  }

  let claimSnapshot: PipelineProject["claimSnapshot"] = null;
  if (row.claim_snapshot) {
    try {
      claimSnapshot = JSON.parse(row.claim_snapshot);
    } catch {
      claimSnapshot = null;
    }
  }

  let brief: PipelineProject["brief"] = null;
  if (row.brief) {
    try {
      brief = JSON.parse(row.brief);
    } catch {
      brief = null;
    }
  }

  let snapshots: PipelineProject["snapshots"] = [];
  if (row.snapshots) {
    try {
      snapshots = JSON.parse(row.snapshots);
    } catch {
      snapshots = [];
    }
  }

  return {
    id: row.id,
    title: row.title,
    currentStage: normalizePipelineStage(row.current_stage),
    targetSkill: (row.target_skill as PipelineProject["targetSkill"]) || null,
    topicId: row.topic_id || null,
    selectedTopic,
    masterContent: row.master_content,
    updatedAt: row.updated_at,
    cardId: row.card_id,
    claimSnapshot,
    brief,
    variants,
    snapshots,
    materials,
    chunkSelection,
  };
}
