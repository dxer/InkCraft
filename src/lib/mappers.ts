import type { AgentItem, KnowledgeBase, NoteItem } from "./types";

export interface KnowledgeRow {
  id: string;
  kb_id?: string | null;
  document_id: string | null;
  chunk_index: number | null;
  title: string | null;
  content: string;
  item_type: string;
  category: string | null;
  tags: string | null;
  auto_meta: number;
  created_at: string;
  updated_at?: string | null;
  source_url?: string | null;
}

export interface DocumentRow {
  id: string;
  kb_id?: string | null;
  title: string;
  source_type: string;
  source_url: string | null;
  category: string | null;
  tags: string | null;
  status: string;
  chunk_count: number;
  created_at: string;
}

export interface AgentRow {
  id: string;
  stage: string;
  name: string;
  persona: string | null;
  system_prompt: string;
  model: string | null;
  temperature: number;
  is_preset: number;
  enabled?: number | null;
}

export interface KbRow {
  id: string;
  name: string;
  description: string | null;
  is_default: number;
  created_at: string;
  notes_count?: number;
}

export function parseTags(json: string | null): string[] {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function mapNote(row: KnowledgeRow): NoteItem {
  const content = row.content || "";
  return {
    id: row.id,
    kbId: row.kb_id || "default",
    title: row.title,
    content,
    wordCount: content.replace(/<[^>]*>/g, "").trim().length,
    category: row.category ?? "通用",
    tags: parseTags(row.tags),
    autoMeta: row.auto_meta === 1,
    sourceUrl: row.source_url || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

export function mapDocument(row: DocumentRow) {
  return {
    id: row.id,
    kbId: row.kb_id || "default",
    title: row.title,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    category: row.category ?? "通用",
    tags: parseTags(row.tags),
    status: row.status,
    chunkCount: row.chunk_count,
    createdAt: row.created_at,
  };
}

export function mapKb(row: KbRow): KnowledgeBase {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isDefault: row.is_default === 1,
    notesCount: row.notes_count || 0,
    createdAt: row.created_at,
  };
}

export function mapAgent(row: AgentRow): AgentItem {
  return {
    id: row.id,
    stage: row.stage,
    name: row.name,
    persona: row.persona,
    systemPrompt: row.system_prompt,
    model: row.model,
    temperature: row.temperature,
    isPreset: row.is_preset === 1,
    enabled: row.enabled === undefined || row.enabled === null || row.enabled === 1,
  };
}
