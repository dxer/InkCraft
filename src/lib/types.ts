export type SourceType = "paste" | "upload" | "web" | "stray";
export type DocStatus = "indexing" | "ready" | "failed";

export interface KnowledgeBase {
 id: string;
 name: string;
 description: string | null;
 isDefault: boolean;
 notesCount: number;
 createdAt: string;
}

export interface NoteItem {
 id: string;
 kbId: string;
 title: string | null;
 content: string;
 wordCount: number;
 category: string;
 tags: string[];
 autoMeta: boolean;
 sourceType?: SourceType;
 sourceUrl?: string | null;
 createdAt: string;
 updatedAt: string;
}

export interface DocumentSummary {
 id: string;
 kbId?: string;
 title: string;
 sourceType: SourceType;
 sourceUrl: string | null;
 category: string;
 tags: string[];
 status: DocStatus;
 chunkCount: number;
 createdAt: string;
}

export interface ChunkItem {
 id: string;
 chunkIndex: number;
 content: string;
}

export interface DocumentDetail extends DocumentSummary {
 chunks: ChunkItem[];
}

export interface CategoryStat {
 name: string;
 count: number;
}

export interface NotesListResponse {
 notes: NoteItem[];
 categories: CategoryStat[];
 kbs: KnowledgeBase[];
 currentKb: string;
 aiConfigured: boolean;
}

export interface NotesSearchResponse {
 query: string;
 notes: (NoteItem & { snippet: string | null })[];
 kbs: KnowledgeBase[];
 currentKb: string;
 aiConfigured: boolean;
}

export type NotesResponse = NotesListResponse | NotesSearchResponse;

export function isNotesSearchResponse(
 r: NotesResponse,
): r is NotesSearchResponse {
 return "query" in r;
}

/**
 * 装配流水线项目状态机：
 * 构思(ideate，内含「选题策划 + 素材匹配」两道工序) → 起草(draft) → 编审分发(review) → 完成(completed)。
 * 与 AI 编辑部的人格名册（custom_agents.stage：topic/evidence/draft/review 四工位）不直接对应——
 * 人格按工序细分，项目按阶段推进。旧值 topic/evidence 读取时兼容归一为 ideate。
 */
export type PipelineStage = "ideate" | "draft" | "review" | "completed";

export function normalizePipelineStage(
 raw: string | null | undefined,
): PipelineStage {
 if (raw === "draft" || raw === "review" || raw === "completed") return raw;
 // topic / evidence 等历史阶段值一律落到构思
 return "ideate";
}

export interface AgentItem {
 id: string;
 stage: "topic" | "evidence" | "draft" | "review";
 name: string;
 persona: string | null;
 systemPrompt: string;
 model: string | null;
 temperature: number;
 isPreset: boolean;
}

export interface SelectedTopic {
 title: string;
 angle?: string;
 outline?: string[];
}

export interface PipelineProject {
 id: string;
 title: string;
 currentStage: PipelineStage;
 selectedTopic: SelectedTopic | null;
 masterContent: string | null;
 updatedAt: string;
 /** 已生成的平台转译版本（platform_id → content），进入工坊时预加载，刷新不丢 */
 variants?: Record<string, string>;
 materials?: {
  id: string;
  itemId: string;
  source: "manual" | "evidence";
  title: string | null;
  content: string;
 }[];
}
