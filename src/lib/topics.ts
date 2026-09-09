import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { parseCardFields } from "./card-md";
import { getDb } from "./db";
import { getAgentForStage } from "./pipeline";
import { getByok, getSettings, setSetting } from "./settings";
import {
  type PlatformSkillId,
  type TopicRadarAngleType,
  type TopicRepositoryItem,
} from "./types";

export interface TopicFilterOptions {
  status?: "all" | "idea" | "used" | "archived";
  targetSkill?: string;
  search?: string;
  sourceType?: "all" | "auto" | "manual";
  excludeIds?: string[];
  orderBy?: "recent" | "score" | "random";
  minScore?: number;
  limit?: number;
  offset?: number;
}

export interface TopicMiningState {
  isMining: boolean;
  status: "idle" | "running" | "completed" | "failed";
  startedAt: string | null;
  lastScannedAt: string | null;
  lastResult: {
    ran: boolean;
    reason?: string;
    newNotesCount?: number;
    savedTopicsCount?: number;
    error?: string;
    completedAt?: string;
  } | null;
}

export interface TopicStats {
  total: number;
  ideas: number;
  used: number;
  archived: number;
  bySkill: Record<string, number>;
  lastScannedAt: string | null;
  newNotesSinceLastScan: number;
  miningState?: TopicMiningState;
}

export const SETTING_KEY_LAST_SCANNED = "topic_mining.last_scanned_at";
export const SETTING_KEY_MINING_STATUS = "topic_mining.status";
export const SETTING_KEY_MINING_STARTED_AT = "topic_mining.started_at";
export const SETTING_KEY_MINING_LAST_RESULT = "topic_mining.last_result";
// 挖掘运行锁：用 DB 标志位而非模块变量 —— instrumentation 定时器与路由 handler 属于不同 bundle，
// 模块级状态互不可见；DB 标志对二者同时生效，防并发挖掘烧双份 Token。
export const SETTING_KEY_MINING_LOCK = "topic_mining.lock_at";

const SKILL_NAME_MAP: Record<PlatformSkillId, string> = {
  wechat: "微信公众号 · 深度叙事",
  xiaohongshu: "小红书笔记 · 痛点爆款",
  zhihu: "知乎回答 · 深度思辨",
  x_thread: "X / 即刻短文 · 极速穿透",
  master: "通用母稿 · 严谨立论",
};

function computeDefaultScore(
  title: string,
  skill: string,
  matchedCardsCount: number,
): { score: number; scoreTag: string } {
  let score = 90;
  if (title.length >= 15 && title.length <= 35) score += 3;
  if (matchedCardsCount >= 2) score += 3;
  if (matchedCardsCount >= 1) score += 1;
  if (
    title.includes("？") ||
    title.includes("！") ||
    title.includes("：") ||
    title.includes("——") ||
    title.includes("90%") ||
    title.includes("为什么")
  )
    score += 1;
  score = Math.min(score, 98);

  let tag = "🔥 爆款潜质";
  if (skill === "zhihu") tag = "💡 深度思辨";
  else if (skill === "xiaohongshu") tag = "📌 痛点爆款";
  else if (skill === "x_thread") tag = "⚡ 高密穿透";
  else if (score >= 95) tag = "🏆 重磅首选";

  return { score, scoreTag: tag };
}

/** 语料进 Prompt 前统一截断，控住单次挖掘的 Token 上限 */
function clip(v: unknown, max: number): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** 从数据库映射选题条目 */
/** JSON.parse 容错：空值/坏 JSON 返回 fallback，不让存量脏字段炸读取路径 */
function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/** 从数据库映射选题条目 */
/** topic_repository 行结构（SELECT 全列时与 mapTopicRow 一一对应） */
interface TopicRow {
  id: string;
  title: string;
  angle: string | null;
  hook: string | null;
  target_skill: string | null;
  score: number | null;
  score_tag: string | null;
  outline: string | null;
  angle_type?: string | null;
  fingerprint?: string | null;
  target_audience?: string | null;
  title_options?: string | null;
  core_argument?: string | null;
  outline_structured?: string | null;
  matched_cards: string | null;
  source_note_ids: string | null;
  source_type: string | null;
  status: string | null;
  used_project_id: string | null;
  created_at: string;
  updated_at: string;
}

/** LLM 返回的原始选题 JSON（字段值未经清洗，落库前逐项校验） */
interface RawGeneratedTopic {
  title?: unknown;
  angle?: unknown;
  hook?: unknown;
  targetSkill?: unknown;
  outline?: unknown;
  materialIndices?: unknown;
}

function mapTopicRow(row: TopicRow): TopicRepositoryItem {
  const outline: string[] = parseJsonField(row.outline, []);
  const matchedCards: TopicRepositoryItem["matchedCards"] = parseJsonField(
    row.matched_cards,
    [],
  );
  const sourceNoteIds: string[] = parseJsonField(row.source_note_ids, []);
  const titleOptions: string[] = parseJsonField(row.title_options, []);
  const outlineStructured: TopicRepositoryItem["outlineStructured"] =
    parseJsonField(row.outline_structured, []);

  const skill = (row.target_skill || "wechat") as PlatformSkillId;
  const def = computeDefaultScore(row.title || "", skill, matchedCards.length);
  const score =
    typeof row.score === "number" && row.score > 0 ? row.score : def.score;
  const scoreTag = row.score_tag || def.scoreTag;

  return {
    id: row.id,
    title: row.title,
    angle: row.angle || "",
    hook: row.hook || "",
    targetSkill: skill,
    targetSkillName: SKILL_NAME_MAP[skill] || "平台创作",
    score,
    scoreTag,
    outline,
    angleType: (row.angle_type as TopicRepositoryItem["angleType"]) || "paradox",
    fingerprint: row.fingerprint || null,
    targetAudience: row.target_audience || null,
    titleOptions: titleOptions.length > 0 ? titleOptions : undefined,
    coreArgument: row.core_argument || row.angle || null,
    outlineStructured:
      outlineStructured.length > 0 ? outlineStructured : undefined,
    matchedCards,
    sourceNoteIds,
    sourceType: (row.source_type || "auto") as "auto" | "manual",
    status: (row.status || "idea") as "idea" | "used" | "archived",
    usedProjectId: row.used_project_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 获取选题列表 */
export function getTopicsFromDb(
  options: TopicFilterOptions & { angleType?: string } = {},
): TopicRepositoryItem[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (options.status && options.status !== "all") {
    conditions.push("status = ?");
    params.push(options.status);
  }

  if (options.targetSkill && options.targetSkill !== "all") {
    conditions.push("target_skill = ?");
    params.push(options.targetSkill);
  }

  if (options.angleType && options.angleType !== "all") {
    conditions.push("angle_type = ?");
    params.push(options.angleType);
  }

  if (options.sourceType && options.sourceType !== "all") {
    conditions.push("source_type = ?");
    params.push(options.sourceType);
  }

  if (options.minScore && typeof options.minScore === "number") {
    conditions.push("(score IS NULL OR score >= ?)");
    params.push(options.minScore);
  }

  if (options.excludeIds && Array.isArray(options.excludeIds) && options.excludeIds.length > 0) {
    const validIds = options.excludeIds.filter((id) => typeof id === "string" && id.trim());
    if (validIds.length > 0) {
      const placeholders = validIds.map(() => "?").join(", ");
      conditions.push(`id NOT IN (${placeholders})`);
      params.push(...validIds);
    }
  }

  if (options.search && options.search.trim()) {
    conditions.push("(title LIKE ? OR angle LIKE ? OR core_argument LIKE ? OR hook LIKE ?)");
    const kw = `%${options.search.trim()}%`;
    params.push(kw, kw, kw, kw);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let orderClause = "ORDER BY created_at DESC";
  if (options.orderBy === "random") {
    orderClause = "ORDER BY RANDOM()";
  } else if (options.orderBy === "score") {
    orderClause = "ORDER BY score DESC, created_at DESC";
  } else if (options.orderBy === "recent") {
    orderClause = "ORDER BY created_at DESC";
  }

  const limitClause = options.limit ? `LIMIT ${Number(options.limit)}` : "";
  const offsetClause = options.offset ? `OFFSET ${Number(options.offset)}` : "";

  const query = `
    SELECT id, title, angle, hook, target_skill, score, score_tag, outline, angle_type, fingerprint, target_audience, title_options, core_argument, outline_structured, matched_cards, source_note_ids, source_type, status, used_project_id, created_at, updated_at
    FROM topic_repository
    ${whereClause}
    ${orderClause}
    ${limitClause} ${offsetClause}
  `;

  const rows = db.prepare(query).all(...params) as TopicRow[];
  return rows.map(mapTopicRow);
}

/** 获取选题库整体统计及新笔记扫描状态 */
export function getTopicStats(): TopicStats {
  const db = getDb();
  const settings = getSettings();
  const lastScannedAt = settings[SETTING_KEY_LAST_SCANNED] || null;

  const totalRow = db
    .prepare("SELECT COUNT(*) as count FROM topic_repository")
    .get() as { count: number };
  const ideasRow = db
    .prepare(
      "SELECT COUNT(*) as count FROM topic_repository WHERE status = 'idea'",
    )
    .get() as { count: number };
  const usedRow = db
    .prepare(
      "SELECT COUNT(*) as count FROM topic_repository WHERE status = 'used'",
    )
    .get() as { count: number };
  const archivedRow = db
    .prepare(
      "SELECT COUNT(*) as count FROM topic_repository WHERE status = 'archived'",
    )
    .get() as { count: number };

  const skillRows = db
    .prepare(
      "SELECT target_skill, COUNT(*) as count FROM topic_repository GROUP BY target_skill",
    )
    .all() as { target_skill: string; count: number }[];
  const bySkill: Record<string, number> = {};
  for (const r of skillRows) {
    bySkill[r.target_skill] = r.count;
  }

  // 统计自上次扫描以来新增的独立笔记数量
  let newNotesCount = 0;
  if (lastScannedAt) {
    const newNotesRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM knowledge_items WHERE chunk_index IS NULL AND created_at > ?",
      )
      .get(lastScannedAt) as { count: number };
    newNotesCount = newNotesRow?.count || 0;
  } else {
    const allNotesRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM knowledge_items WHERE chunk_index IS NULL",
      )
      .get() as { count: number };
    newNotesCount = allNotesRow?.count || 0;
  }

  return {
    total: totalRow?.count || 0,
    ideas: ideasRow?.count || 0,
    used: usedRow?.count || 0,
    archived: archivedRow?.count || 0,
    bySkill,
    lastScannedAt,
    newNotesSinceLastScan: newNotesCount,
    miningState: getTopicMiningState(),
  };
}

/**
 * 获取当前选题雷达挖掘任务状态（自动处理 5 分钟超时容错）
 */
export function getTopicMiningState(): TopicMiningState {
  const settings = getSettings();
  const rawStatus = settings[SETTING_KEY_MINING_STATUS] || "idle";
  const startedAt = settings[SETTING_KEY_MINING_STARTED_AT] || null;
  const lastScannedAt = settings[SETTING_KEY_LAST_SCANNED] || null;
  let lastResult: TopicMiningState["lastResult"] = null;

  if (settings[SETTING_KEY_MINING_LAST_RESULT]) {
    try {
      lastResult = JSON.parse(settings[SETTING_KEY_MINING_LAST_RESULT]);
    } catch {}
  }

  // 超时判定（超过 10 分钟自动解除 running 状态，避免进程中断死锁）
  const now = Date.now();
  const isExpired =
    rawStatus === "running" &&
    startedAt &&
    now - Date.parse(startedAt) > 10 * 60 * 1000;

  if (isExpired) {
    setSetting(SETTING_KEY_MINING_STATUS, "idle");
    setSetting(SETTING_KEY_MINING_LOCK, "");
    return {
      isMining: false,
      status: "idle",
      startedAt,
      lastScannedAt,
      lastResult: {
        ran: false,
        reason: "上次选题挖掘任务超时（>10分钟）已自动解除锁定",
        completedAt: new Date().toISOString(),
      },
    };
  }

  const isMining = rawStatus === "running";
  return {
    isMining,
    status: isMining ? "running" : (rawStatus as TopicMiningState["status"]),
    startedAt,
    lastScannedAt,
    lastResult,
  };
}

/**
 * 触发异步每小时增量挖掘（非阻塞后台运行）
 */
export function triggerHourlyMiningAsync(options: { force?: boolean } = {}): {
  started: boolean;
  message: string;
  state: TopicMiningState;
} {
  const currentState = getTopicMiningState();
  if (currentState.isMining) {
    return {
      started: false,
      message: "已有选题挖掘任务在运行中，请稍候...",
      state: currentState,
    };
  }

  const nowIso = new Date().toISOString();
  setSetting(SETTING_KEY_MINING_STATUS, "running");
  setSetting(SETTING_KEY_MINING_STARTED_AT, nowIso);
  setSetting(SETTING_KEY_MINING_LOCK, nowIso);

  checkAndMineHourlyTopics(options)
    .then((res) => {
      const completedIso = new Date().toISOString();
      setSetting(SETTING_KEY_LAST_SCANNED, completedIso);
      setSetting(SETTING_KEY_MINING_STATUS, "completed");
      setSetting(SETTING_KEY_MINING_LOCK, "");
      setSetting(
        SETTING_KEY_MINING_LAST_RESULT,
        JSON.stringify({
          ran: res.ran,
          reason: res.reason,
          newNotesCount: res.newNotesCount,
          savedTopicsCount: res.savedTopicsCount,
          completedAt: completedIso,
        }),
      );
    })
    .catch((err) => {
      console.error("[topics] async hourly mining error:", err);
      const completedIso = new Date().toISOString();
      setSetting(SETTING_KEY_LAST_SCANNED, completedIso);
      setSetting(SETTING_KEY_MINING_STATUS, "failed");
      setSetting(SETTING_KEY_MINING_LOCK, "");
      setSetting(
        SETTING_KEY_MINING_LAST_RESULT,
        JSON.stringify({
          ran: false,
          error: err instanceof Error ? err.message : "选题生成异常中断",
          completedAt: completedIso,
        }),
      );
    });

  return {
    started: true,
    message: "周期选题挖掘任务已在后台启动",
    state: getTopicMiningState(),
  };
}

/**
 * 保存单个选题到选题库（严格根据标题查重）
 * 若已存在相同标题的选题，则跳过或合并更新，杜绝重复产生。
 */
export function saveTopicToRepository(
  item: Partial<TopicRepositoryItem> & { title: string },
): { topic: TopicRepositoryItem; created: boolean } {
  const db = getDb();
  const cleanTitle = String(item.title || "").trim();
  if (!cleanTitle) {
    throw new Error("选题标题不能为空");
  }

  const existing = db
    .prepare(
      "SELECT id, title, angle, hook, target_skill, score, score_tag, outline, angle_type, fingerprint, target_audience, title_options, core_argument, outline_structured, matched_cards, source_note_ids, source_type, status, used_project_id, created_at, updated_at FROM topic_repository WHERE title = ?",
    )
    .get(cleanTitle) as TopicRow | undefined;

  if (existing) {
    return {
      topic: mapTopicRow(existing),
      created: false,
    };
  }

  const id = item.id || randomUUID();
  const targetSkill = item.targetSkill || "wechat";
  const def = computeDefaultScore(
    cleanTitle,
    targetSkill,
    (item.matchedCards || []).length,
  );
  const score =
    typeof item.score === "number" && item.score > 0 ? item.score : def.score;
  const scoreTag = item.scoreTag || def.scoreTag;
  const outlineJson = JSON.stringify(item.outline || []);
  const titleOptionsJson = item.titleOptions
    ? JSON.stringify(item.titleOptions)
    : null;
  const outlineStructuredJson = item.outlineStructured
    ? JSON.stringify(item.outlineStructured)
    : null;
  const matchedCardsJson = JSON.stringify(item.matchedCards || []);
  const sourceNoteIdsJson = JSON.stringify(item.sourceNoteIds || []);
  const sourceType = item.sourceType || "manual";
  const status = item.status || "idea";
  const angleType = item.angleType || "paradox";
  const fingerprint = item.fingerprint || null;
  const targetAudience = item.targetAudience || null;
  const coreArgument = item.coreArgument || item.angle || null;

  const insertRes = db
    .prepare(`
    INSERT INTO topic_repository (
      id, title, angle, hook, target_skill, score, score_tag, outline, angle_type, fingerprint, target_audience, title_options, core_argument, outline_structured, matched_cards, source_note_ids, source_type, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(title) DO NOTHING
  `)
    .run(
      id,
      cleanTitle,
      item.angle || "",
      item.hook || "",
      targetSkill,
      score,
      scoreTag,
      outlineJson,
      angleType,
      fingerprint,
      targetAudience,
      titleOptionsJson,
      coreArgument,
      outlineStructuredJson,
      matchedCardsJson,
      sourceNoteIdsJson,
      sourceType,
      status,
    );

  // 正常情况下上面的 SELECT 已挡掉重复；ON CONFLICT 只兜并发写穿（极窄窗口），
  // 此时按标题回查已有行并标记未新建。
  const inserted =
    (db
      .prepare(
        "SELECT id, title, angle, hook, target_skill, score, score_tag, outline, angle_type, fingerprint, target_audience, title_options, core_argument, outline_structured, matched_cards, source_note_ids, source_type, status, used_project_id, created_at, updated_at FROM topic_repository WHERE id = ?",
      )
      .get(id) as TopicRow) ||
    (db
      .prepare(
        "SELECT id, title, angle, hook, target_skill, score, score_tag, outline, angle_type, fingerprint, target_audience, title_options, core_argument, outline_structured, matched_cards, source_note_ids, source_type, status, used_project_id, created_at, updated_at FROM topic_repository WHERE title = ?",
      )
      .get(cleanTitle) as TopicRow);

  return {
    topic: mapTopicRow(inserted),
    created: insertRes.changes > 0,
  };
}

/** 批量保存选题到选题库 */
export function batchSaveTopicsToRepository(
  items: Array<Partial<TopicRepositoryItem> & { title: string }>,
): { savedCount: number; topics: TopicRepositoryItem[] } {
  const db = getDb();
  // 批量保存包进事务：中途失败整体回滚，不留半批落库
  const runBatch = db.transaction(
    (list: Array<Partial<TopicRepositoryItem> & { title: string }>) => {
      const results: TopicRepositoryItem[] = [];
      let savedCount = 0;
      for (const item of list) {
        if (!item.title || !item.title.trim()) continue;
        const { topic, created } = saveTopicToRepository(item);
        results.push(topic);
        if (created) savedCount++;
      }
      return { results, savedCount };
    },
  );
  const { results, savedCount } = runBatch(items);
  return { savedCount, topics: results };
}

/** 更新选题状态 */
export function updateTopicStatusInDb(
  id: string,
  status: "idea" | "used" | "archived",
): boolean {
  const db = getDb();
  const res = db
    .prepare(
      "UPDATE topic_repository SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .run(status, id);
  return res.changes > 0;
}

/** 删除选题 */
export function deleteTopicFromDb(id: string): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM topic_repository WHERE id = ?").run(id);
  return res.changes > 0;
}

/**
 * 每小时定时选题生成核心算法：
 * 1. 检查距离上次扫描是否已超过 1 小时（支持 force 立即执行）；
 * 2. 仅查询上次扫描之后收录的全新笔记（如果该时段无新收录，直接退出，消耗 0 Token）；
 * 3. 获取历史已存在的选题标题，在 Prompt 中强制声明防重；
 * 4. 针对新收录笔记生成高价值平台选题，落库到 topic_repository；
 * 5. 刷新上次扫描时间戳。
 */
export type TopicMineResult = {
  ran: boolean;
  reason?: string;
  newNotesCount: number;
  savedTopicsCount: number;
  topics: TopicRepositoryItem[];
};

/** 并发保护包装：页面懒检查 / mine 路由 / instrumentation 定时器并发调用时只跑一轮挖掘（DB 锁跨 bundle 生效） */
export async function checkAndMineHourlyTopics(
  options: { force?: boolean } = {},
): Promise<TopicMineResult> {
  const db = getDb();
  const lockRow = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(SETTING_KEY_MINING_LOCK) as { value: string | null } | undefined;
  const lockAt = lockRow?.value ? Date.parse(lockRow.value) : 0;
  if (lockAt && Date.now() - lockAt < 10 * 60 * 1000) {
    return {
      ran: false,
      reason: "已有选题挖掘任务在运行，本次跳过（并发保护）",
      newNotesCount: 0,
      savedTopicsCount: 0,
      topics: [],
    };
  }
  setSetting(SETTING_KEY_MINING_LOCK, new Date().toISOString());
  try {
    return await runMiningOnce(options);
  } finally {
    setSetting(SETTING_KEY_MINING_LOCK, "");
  }
}

/** 单次挖掘实体逻辑（被外层包上并发锁后调用） */
async function runMiningOnce(
  options: { force?: boolean } = {},
): Promise<TopicMineResult> {
  const db = getDb();
  const settings = getSettings();
  const lastScannedAt = settings[SETTING_KEY_LAST_SCANNED];
  const now = new Date();

  // 1. 周期时间检查（若未强制且未满 1 小时，则跳过）
  if (!options.force && lastScannedAt) {
    const elapsedMs = now.getTime() - new Date(lastScannedAt).getTime();
    if (elapsedMs < 60 * 60 * 1000) {
      const remainingMinutes = Math.ceil((60 * 60 * 1000 - elapsedMs) / 60000);
      return {
        ran: false,
        reason: `距离上次分析不足 1 小时（约剩余 ${remainingMinutes} 分钟），暂不执行周期分析`,
        newNotesCount: 0,
        savedTopicsCount: 0,
        topics: [],
      };
    }
  }

  // 2. 查询自上次扫描以来新收录的笔记（按创建时间升序，取最新 10 篇）
  let newNotes: Array<{
    id: string;
    title: string | null;
    content: string;
    created_at: string;
  }> = [];
  if (lastScannedAt) {
    newNotes = db
      .prepare(
        "SELECT id, title, content, created_at FROM knowledge_items WHERE chunk_index IS NULL AND created_at > ? ORDER BY created_at DESC LIMIT 10",
      )
      .all(lastScannedAt) as Array<{
      id: string;
      title: string | null;
      content: string;
      created_at: string;
    }>;
  } else {
    // 首次运行时，只取最新收录的 3 篇笔记作为试点，避免全库分析导致 Token 爆炸
    newNotes = db
      .prepare(
        "SELECT id, title, content, created_at FROM knowledge_items WHERE chunk_index IS NULL ORDER BY created_at DESC LIMIT 3",
      )
      .all() as Array<{
      id: string;
      title: string | null;
      content: string;
      created_at: string;
    }>;
  }

  // 查重抑制：如果新笔记在选题库中已经存在待创作（status = 'idea'）的选题，则予以排除，防止同一篇笔记被反复生成多个选题
  const existingIdeaTopicRows = db
    .prepare(
      "SELECT source_note_ids FROM topic_repository WHERE status = 'idea'",
    )
    .all() as { source_note_ids: string | null }[];
  const coveredNoteIds = new Set<string>();
  for (const row of existingIdeaTopicRows) {
    for (const nid of parseJsonField<string[]>(row.source_note_ids, [])) {
      coveredNoteIds.add(nid);
    }
  }

  const unminedNotes = options.force
    ? newNotes
    : newNotes.filter((n) => !coveredNoteIds.has(n.id));

  // 若无可分析的新收录笔记：更新扫描时间戳，直接跳过，0 token 消耗！
  if (unminedNotes.length === 0) {
    setSetting(SETTING_KEY_LAST_SCANNED, now.toISOString());
    return {
      ran: false,
      reason:
        newNotes.length > 0
          ? "新收录笔记在选题库中已有待写选题，暂无须重复生成"
          : "当前周期内无新收录笔记，保持现有选题储备",
      newNotesCount: newNotes.length,
      savedTopicsCount: 0,
      topics: [],
    };
  }

  // 3. 提取新笔记关联的知识卡片（若有）
  const noteIds = unminedNotes.map((n) => n.id);
  const placeholders = noteIds.map(() => "?").join(",");
  const cardRows = db
    .prepare(`
    SELECT c.id, c.document_id, c.content_md, ki.title AS note_title
    FROM knowledge_cards c
    JOIN knowledge_items ki ON ki.id = c.document_id
    WHERE c.document_id IN (${placeholders})
  `)
    .all(...noteIds) as Array<{
    id: string;
    document_id: string;
    content_md: string;
    note_title: string | null;
  }>;

  const cardMap = new Map(cardRows.map((c) => [c.document_id, c]));

  // 4. 获取历史已存在的选题标题，杜绝重复
  const existingTitles = (
    db
      .prepare(
        "SELECT title FROM topic_repository ORDER BY created_at DESC LIMIT 80",
      )
      .all() as Array<{ title: string }>
  ).map((r) => r.title.trim());

  // 5. 组装输入语料（每条语料截断控 Token，知识卡片字段也可能很长）
  const noteMaterials = unminedNotes
    .map((n, idx) => {
      const title = clip(n.title, 60) || "未命名笔记";
      const card = cardMap.get(n.id);
      if (card) {
        const f = parseCardFields(card.content_md);
        return `【新收录资料 ${idx + 1}】《${title}》 (ID: ${n.id})\n  核心主张：${clip(f.claim, 300) || title}\n  边界/切口：${clip(f.applicable || f.cut, 200) || "通用"}\n  原文提要：${clip(n.content, 200)}`;
      }
      return `【新收录资料 ${idx + 1}】《${title}》 (ID: ${n.id})\n  内容提要：${clip(n.content, 300)}`;
    })
    .join("\n\n");

  const cfg = getByok();
  const topicAgent = getAgentForStage("topic");

  let generatedRawTopics: RawGeneratedTopic[] = [];

  if (cfg) {
    try {
      const provider = createOpenAICompatible({
        name: "inkcraft",
        baseURL: cfg.baseUrl,
        apiKey: cfg.apiKey,
      });

      const existingConstraint =
        existingTitles.length > 0
          ? `\n【历史已存在的选题库（严禁重复或高度雷同！）】：\n${existingTitles
              .slice(0, 40)
              .map((t, i) => `${i + 1}. ${t}`)
              .join("\n")}`
          : "";

      const systemPrompt =
        topicAgent?.system_prompt ||
        `你是创作总监与深度内容策划专家。
你的任务是专门针对创作者刚刚新收录的这批知识材料进行精益选题策划。

严格遵循三大收敛原则（拒绝泛滥，注重立论精度与张力）：
1. 【一笔记一核心方案】：针对每一篇输入的新笔记，产出 1 个立论深刻、结构严谨的母稿选题方案；
2. 【跨笔记交叉融合】：如果本次输入包含 2 篇及以上笔记，额外挑选 2 篇具有观点呼应、反常识张力或互为论据的笔记，合成 1 个【跨界融合大选题】；
3. 【严格防重】：绝对不能与历史已有的选题库标题重复，必须产生新颖、具洞察力的全新切角；
4. 严格输出 JSON 数组，不带任何思考或说明文字。`;

      const userPrompt = [
        `【创作者刚刚收录的全新知识材料（共 ${unminedNotes.length} 篇）】：\n${noteMaterials}`,
        existingConstraint,
        `\n请输出选题方案：对每篇资料出 1 个母稿选题（${unminedNotes.length} 个）${unminedNotes.length >= 2 ? " + 1 个跨资料交叉融合选题" : ""}，严格输出 JSON 格式如下：
[
  {
    "title": "爆款标题（极具吸引力且契合新材料，绝不与历史选题重复）",
    "angle": "核心论据切角与论证重点（1-2句）",
    "hook": "正文开头第一段的吸睛引子/冲突破题句",
    "outline": [
      "一、章节/分点1",
      "二、章节/分点2",
      "三、章节/分点3"
    ],
    "materialIndices": [1] // 对应引用的新收录资料序号 (1-based index)
  }
]`,
      ].join("\n\n");

      const { text } = await generateText({
        model: provider.chatModel(topicAgent?.model || cfg.model),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: topicAgent?.temperature || 0.85,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(180_000),
      });

      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start !== -1 && end > start) {
        generatedRawTopics = JSON.parse(
          text.slice(start, end + 1),
        ) as RawGeneratedTopic[];
      }
    } catch (err) {
      console.error("[topics] hourly topic mining LLM error:", err);
      return {
        ran: false,
        reason: `大模型选题生成失败: ${err instanceof Error ? err.message : "请求超时或网络异常"}`,
        newNotesCount: unminedNotes.length,
        savedTopicsCount: 0,
        topics: [],
      };
    }
  } else {
    return {
      ran: false,
      reason: "请先在系统设置中配置大模型 API Key 后再触发选题生成",
      newNotesCount: unminedNotes.length,
      savedTopicsCount: 0,
      topics: [],
    };
  }

  // 严格杜绝模板兜底数据：如果模型未能产出有效方案，直接明确返回原因
  if (!Array.isArray(generatedRawTopics) || generatedRawTopics.length === 0) {
    return {
      ran: false,
      reason: "大模型未返回有效的选题 JSON 结构",
      newNotesCount: unminedNotes.length,
      savedTopicsCount: 0,
      topics: [],
    };
  }

  // 6. 落库保存并排重
  const savedTopics: TopicRepositoryItem[] = [];
  for (const raw of generatedRawTopics) {
    const title = String(raw.title || "").trim();
    if (!title) continue;
    // 双重排重检查：既不与库中历史重复，也不与本批次新生成的重复
    if (
      existingTitles.includes(title) ||
      savedTopics.some((t) => t.title === title)
    ) {
      continue;
    }

    const targetSkill: PlatformSkillId = "master";

    const matIdxs: number[] = Array.isArray(raw.materialIndices)
      ? raw.materialIndices
      : [1];
    const sourceNotes = matIdxs.map((i) => unminedNotes[i - 1]).filter(Boolean);
    const sourceNoteIds = sourceNotes.map((n) => n.id);

    const matchedCards = sourceNotes.map((n) => {
      const card = cardMap.get(n.id);
      if (card) {
        const f = parseCardFields(card.content_md);
        return {
          id: card.id,
          docId: card.document_id,
          claim: f.claim || card.note_title || "",
          noteTitle: card.note_title || "关联笔记",
        };
      }
      return {
        id: n.id,
        docId: n.id,
        claim: n.title || "知识笔记",
        noteTitle: n.title || "关联笔记",
      };
    });

    const { topic, created } = saveTopicToRepository({
      title,
      angle: String(raw.angle || "").trim(),
      hook: String(raw.hook || "").trim(),
      targetSkill,
      outline: Array.isArray(raw.outline) ? raw.outline.map(String) : [],
      matchedCards,
      sourceNoteIds,
      sourceType: "auto",
      status: "idea",
    });

    if (created) {
      savedTopics.push(topic);
    }
  }

  // 7. 更新扫描时间戳
  setSetting(SETTING_KEY_LAST_SCANNED, now.toISOString());

  return {
    ran: true,
    newNotesCount: unminedNotes.length,
    savedTopicsCount: savedTopics.length,
    topics: savedTopics,
  };
}
