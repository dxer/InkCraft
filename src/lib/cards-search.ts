import { getAllCards } from "./cards";
import { parseCardFields } from "./card-md";

export interface CardSearchResult {
  cardId: string;
  documentId: string;
  relevanceScore: number;
  matchedReason: string;
  matchedKeywords: string[];
  claim: string;
  hook: string;
  mechanism: string;
  boundary: string;
  tags: string[];
  noteTitle: string;
}

export interface CardSearchOptions {
  query?: string;
  tags?: string[];
  limit?: number;
  minScore?: number;
}

/** 停用助词表（中英文常见停用词，提升概念匹配纯度） */
const STOP_WORDS = new Set([
  "的", "了", "和", "是", "在", "我", "有", "也", "就", "不", "人", "都", "一", "一个",
  "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好",
  "自己", "这", "那", "如何", "怎么", "什么", "为什么", "关于", "对于", "以及", "通过",
  "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with", "by", "of", "about",
]);

/** 从自然语言 query 中提取关键概念词 */
export function extractKeywords(text: string): string[] {
  if (!text || typeof text !== "string") return [];

  // 清洗特殊标点
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();

  // 1. 英文与连续数字词切分
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  const keywords: string[] = [];

  for (const token of rawTokens) {
    // 包含中文的词进行 2~4 字 n-gram 与整体切分
    if (/[\u4e00-\u9fa5]/.test(token)) {
      if (token.length >= 2 && !STOP_WORDS.has(token)) {
        keywords.push(token);
      }
      // 切 2-gram / 3-gram
      for (let len = 2; len <= Math.min(4, token.length); len++) {
        for (let i = 0; i <= token.length - len; i++) {
          const sub = token.slice(i, i + len);
          if (!STOP_WORDS.has(sub) && sub.length >= 2) {
            keywords.push(sub);
          }
        }
      }
    } else {
      if (token.length >= 2 && !STOP_WORDS.has(token)) {
        keywords.push(token);
      }
    }
  }

  return Array.from(new Set(keywords));
}

/** 检查文本/数组中命中了哪些关键词 */
function findHits(input: unknown, keywords: string[]): string[] {
  if (!input || keywords.length === 0) return [];
  let text = "";
  if (typeof input === "string") {
    text = input;
  } else if (Array.isArray(input)) {
    text = input.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ");
  } else if (typeof input === "object") {
    text = JSON.stringify(input);
  } else {
    text = String(input);
  }
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw));
}

/**
 * 多维度高匹配卡片加权打分检索
 * 专为 Agent 意图检索设计：
 * - 核心论断 claim 权重: 4.0
 * - 底层机制 mechanism 权重: 2.5
 * - 适用边界 boundary 权重: 2.0
 * - 领域标签 tags / cut 权重: 1.5
 * - 正文全文 content_md 权重: 1.0
 */
export function searchCardsByRelevance(
  options: CardSearchOptions = {},
): { query: string; totalMatched: number; results: CardSearchResult[] } {
  const { query = "", tags = [], limit = 8, minScore = 15 } = options;
  const rawCards = getAllCards();
  const trimmedQuery = query.trim();
  const keywords = extractKeywords(trimmedQuery);

  const matchedList: CardSearchResult[] = [];

  for (const card of rawCards) {
    const fields = parseCardFields(card.content_md);
    const cardTags: string[] = Array.isArray(card.note_tags) ? card.note_tags : [];

    // 标签过滤（若指定 tags 则必须有交集）
    if (tags && tags.length > 0) {
      const hasTagOverlap = tags.some((t) =>
        cardTags.some((ct: string) => ct.toLowerCase().includes(t.toLowerCase())),
      );
      if (!hasTagOverlap) continue;
    }

    const claim = fields.claim || fields.frontmatter?.title || "原子卡片";
    const hook = fields.cut || fields.quote || "";
    const mechanism = fields.parts?.[0]?.text || "";
    const boundary = fields.notApplicable || fields.applicable || "";
    const contentMd = card.content_md || "";
    const noteTitle = card.note_title || "关联笔记";

    // 若无 query，纯按创建时间排序，赋默认分
    if (keywords.length === 0) {
      matchedList.push({
        cardId: card.id,
        documentId: card.document_id,
        relevanceScore: 60,
        matchedReason: "默认精选推荐",
        matchedKeywords: [],
        claim,
        hook,
        mechanism,
        boundary,
        tags: cardTags,
        noteTitle,
      });
      continue;
    }

    // 计算各维度命中
    const claimHits = findHits(claim, keywords);
    const mechanismHits = findHits(mechanism, keywords);
    const boundaryHits = findHits(boundary, keywords);
    const tagHits = findHits(cardTags.join(" "), keywords);
    const hookHits = findHits(hook, keywords);
    const fullHits = findHits(contentMd, keywords);

    const allHits = Array.from(
      new Set([
        ...claimHits,
        ...mechanismHits,
        ...boundaryHits,
        ...tagHits,
        ...hookHits,
        ...fullHits,
      ]),
    );

    if (allHits.length === 0) continue;

    // 加权分值计算
    let weightedScore = 0;
    const reasons: string[] = [];

    if (claimHits.length > 0) {
      const ratio = claimHits.length / keywords.length;
      weightedScore += ratio * 45 + claimHits.length * 15;
      reasons.push(`核心论点命中 [${claimHits.slice(0, 3).join(", ")}]`);
    }

    if (mechanismHits.length > 0) {
      const ratio = mechanismHits.length / keywords.length;
      weightedScore += ratio * 25 + mechanismHits.length * 8;
      reasons.push(`底层机制命中 [${mechanismHits.slice(0, 3).join(", ")}]`);
    }

    if (boundaryHits.length > 0) {
      const ratio = boundaryHits.length / keywords.length;
      weightedScore += ratio * 20 + boundaryHits.length * 6;
      reasons.push(`适用边界命中 [${boundaryHits.slice(0, 2).join(", ")}]`);
    }

    if (tagHits.length > 0 || hookHits.length > 0) {
      const comboHits = Array.from(new Set([...tagHits, ...hookHits]));
      weightedScore += comboHits.length * 10;
      reasons.push(`标签与切角命中 [${comboHits.slice(0, 2).join(", ")}]`);
    }

    if (fullHits.length > 0 && reasons.length === 0) {
      weightedScore += fullHits.length * 5;
      reasons.push(`正文相关内容命中 [${fullHits.slice(0, 3).join(", ")}]`);
    }

    // 归一化到 0 ~ 100 分
    const normalizedScore = Math.min(100, Math.max(10, Math.round(weightedScore)));

    if (normalizedScore >= minScore) {
      matchedList.push({
        cardId: card.id,
        documentId: card.document_id,
        relevanceScore: normalizedScore,
        matchedReason: reasons.join("； ") || "相关内容命中",
        matchedKeywords: allHits,
        claim,
        hook,
        mechanism,
        boundary,
        tags: cardTags,
        noteTitle,
      });
    }
  }

  // 按相关度得分降序排序
  const sorted = matchedList
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  return {
    query: trimmedQuery,
    totalMatched: sorted.length,
    results: sorted,
  };
}
