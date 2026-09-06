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

export interface KnowledgeCard {
 id: string;
 document_id: string;
 content_md: string;
 created_at?: string;
 updated_at?: string;
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
 * 选题(ideate，仅非卡片模式) → 锁题(topic，四行题旨，全模式必经) → 取证(gather) → 起草(draft) → 核稿分发(review) → 完成(completed)。
 * 卡片模式（cardId 非空）跳过选题，从锁题进入。
 * 与 AI 编辑部的人格名册（custom_agents.stage：topic/brief/evidence/draft/review 等工位）不直接对应——
 * 人格按工序细分，项目按阶段推进。历史阶段值 evidence 读取时兼容归一为选题。
 */
export type PipelineStage = "ideate" | "topic" | "gather" | "draft" | "review" | "completed";

export type PlatformSkillId = "wechat" | "xiaohongshu" | "zhihu" | "x_thread" | "master";

export interface PlatformSkillMeta {
 id: PlatformSkillId;
 name: string;
 badge: string;
 desc: string;
 icon: string;
 color: string;
}

export const PLATFORM_SKILLS: PlatformSkillMeta[] = [
 {
  id: "wechat",
  name: "微信公众号",
  badge: "深度叙事",
  desc: "故事切入 · 痛点共鸣 · 论点金句 · 留白排版",
  icon: "MessageSquare",
  color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
 },
 {
  id: "xiaohongshu",
  name: "小红书笔记",
  badge: "爆款清单",
  desc: "抓人首句 · Emoji 呼吸感 · 痛点清单 · 互动钩子",
  icon: "Sparkles",
  color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
 },
 {
  id: "zhihu",
  name: "知乎回答",
  badge: "深度思辨",
  desc: "先亮观点 · 犀利直白 · 结构拆解 · 反常识论证",
  icon: "Compass",
  color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
 },
 {
  id: "x_thread",
  name: "X / 即刻短文",
  badge: "高密推文",
  desc: "穿透短句 · 1/N 连击串 · 极简紧凑 · 转发号召",
  icon: "Share2",
  color: "text-zinc-800 dark:text-zinc-200 bg-zinc-500/10 border-zinc-500/20",
 },
 {
  id: "master",
  name: "通用母稿",
  badge: "长文沉淀",
  desc: "体系化论述 · 论据严密 · 事实标注 · 知识资产",
  icon: "FileText",
  color: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20",
 },
];

export function normalizePipelineStage(
 raw: string | null | undefined,
): PipelineStage {
 if (
  raw === "topic" ||
  raw === "gather" ||
  raw === "draft" ||
  raw === "review" ||
  raw === "completed"
 ) {
  return raw;
 }
 // evidence 等历史阶段值一律落到选题
 return "ideate";
}

/** 四行题旨：锁题工位产物，取证与起草的共同输入 */
export interface TopicBrief {
 /** 给谁看 */
 audience: string;
 /** 读者要接受的那句话 */
 acceptance: string;
 /** 开篇意图（一句话） */
 intent: string;
 /** 不写什么 */
 avoid: string;
}

/** 卡片快照：选卡确认时冻结的主张与关键信息，原卡后续修改不影响项目 */
export interface ClaimSnapshot {
 claim: string;
 noteTitle: string | null;
 /** 边界（适用/反适用）摘要 */
 boundary: string | null;
 /** 切口 */
 cut: string | null;
 /** 信度（来源形态） */
 confidence: string | null;
}

export interface AgentItem {
 id: string;
 stage: string;
 name: string;
 persona: string | null;
 systemPrompt: string;
 model: string | null;
 temperature: number;
 isPreset: boolean;
 enabled?: boolean;
}

export interface SelectedTopic {
	title: string;
	angle?: string;
	hook?: string;
	outline?: string[];
}

export interface ProjectSnapshot {
	id: string;
	createdAt: string;
	wordCount: number;
	preview: string;
	content: string;
	trigger?: "auto" | "draft" | "manual";
}

export interface PipelineProject {
	id: string;
	title: string;
	currentStage: PipelineStage;
	/** 创作目标平台技能（直出模式）：wechat | xiaohongshu | zhihu | x_thread | master */
	targetSkill?: PlatformSkillId | null;
	/** 关联的选题库 ID（从选题库发起创作时关联，成稿后双向回溯） */
	topicId?: string | null;
	selectedTopic: SelectedTopic | null;
	masterContent: string | null;
	updatedAt: string;
	/** 卡片模式：来源卡片 id，非空即卡片模式（跳过选题，从锁题进入） */
	cardId?: string | null;
	/** 卡片模式：选卡确认时冻结的主张快照 */
	claimSnapshot?: ClaimSnapshot | null;
	/** 锁题工位产物：四行题旨 */
	brief?: TopicBrief | null;
	/** 取证素材包：已勾选切片（起草时以 [S1]…[Sn] 编号注入） */
	chunkSelection?: { chunkId: string; packedText: string | null; noteTitle: string | null; text: string }[];
	/** 已生成的平台转译版本（platform_id → content），进入工坊时预加载，刷新不丢 */
	variants?: Record<string, string>;
	/** 历史草稿快照列表（防误点重新起草覆写） */
	snapshots?: ProjectSnapshot[];
	materials?: {
		id: string;
		itemId: string;
		source: "manual" | "evidence";
		title: string | null;
		content: string;
	}[];
}

export interface TopicRepositoryItem {
	id: string;
	title: string;
	angle: string;
	hook: string;
	targetSkill: PlatformSkillId;
	targetSkillName?: string;
	score?: number;
	viralScore?: number;
	depthScore?: number;
	scoreTag?: string;
	outline: string[];
	matchedCards: {
		id: string;
		docId: string;
		claim: string;
		noteTitle: string;
	}[];
	sourceNoteIds?: string[];
	sourceType: "auto" | "manual";
	status: "idea" | "used" | "archived";
	usedProjectId?: string | null;
	usedProjectTitle?: string | null;
	createdAt: string;
	updatedAt: string;
}

