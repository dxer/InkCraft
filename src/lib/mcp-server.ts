import { searchCardsByRelevance } from "./cards-search";
import { parseCardFields } from "./card-md";
import { getAllCards } from "./cards";
import { getTopicsFromDb, getTopicStats } from "./topics";
import { getDb } from "./db";
import { ftsSearchNotes, likeSearchNotes } from "./search";
import { computeCardJaccardSimilarity, type RadarCardCandidate } from "./topic-radar";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** 暴露给外部 Agent 的 9 大核心只读 Tools */
export const MCP_TOOLS: McpTool[] = [
  // ================= 1. 原子知识卡片层 =================
  {
    name: "search_cards_by_query",
    description:
      "【最常用】根据自然语言意图或关键词检索知识库中高匹配的原子知识卡片。返回核心论点(claim)、底层推导(mechanism)、适用边界(boundary)、匹配分值(relevanceScore)与命中原因(matchedReason)。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词或自然语言意图描述（如：'注意力残留与多任务切换的代价'）",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "可选的领域标签过滤数组（如：['认知科学', '效能']）",
        },
        kb_id: {
          type: "string",
          description: "可选的特定知识库 ID 过滤",
        },
        include_content: {
          type: "boolean",
          description: "是否在检索结果中直接包含卡片完整 Markdown 原文（默认 false；小批量检索时设为 true 可一步到位）",
        },
        limit: {
          type: "number",
          description: "最多返回卡片数量，默认 8 条（1~30）",
        },
      },
    },
  },
  {
    name: "get_card_detail",
    description:
      "获取原子知识卡片的完整内容与结构化元数据。支持单张卡片查询（card_id），也支持批量获取（card_ids）。",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "单张卡片的唯一 ID（如：card_abc123）",
        },
        card_ids: {
          type: "array",
          items: { type: "string" },
          description: "可选：批量获取的多张卡片 ID 列表",
        },
      },
    },
  },

  // ================= 2. 原始文档与长文语料层 =================
  {
    name: "list_knowledge_bases",
    description:
      "获取当前系统中的所有知识库分类清单及宏观统计（包含知识库 ID、名称、描述、文档数与卡片数）。",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "search_documents",
    description:
      "在原始知识笔记与母档中进行语义与全文检索（包含完整案例、长篇论文、网页剪藏正文等长篇语料）。支持按关键词检索或按知识库/标签过滤，返回匹配的文档列表、摘要高亮片段(snippet)、分类与标签。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "可选：搜索关键词或主题意图描述（为空时按知识库/标签列出最新文档）",
        },
        kb_id: {
          type: "string",
          description: "可选：限定特定的知识库分类 ID",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "可选：按领域标签过滤",
        },
        limit: {
          type: "number",
          description: "最多返回条数，默认 8（1~30）",
        },
      },
    },
  },
  {
    name: "get_document_detail",
    description:
      "获取指定原始笔记/文档的完整 Markdown 原文、元数据及从该文档萃取出的全部原子卡片列表。",
    inputSchema: {
      type: "object",
      properties: {
        document_id: {
          type: "string",
          description: "原始文档/笔记唯一 ID",
        },
      },
      required: ["document_id"],
    },
  },

  // ================= 3. 网状关联与概念发现层 =================
  {
    name: "find_related_cards",
    description:
      "卡片盒笔记法（Zettelkasten）网状关联拓扑发现。根据指定的原子卡片 ID，沿其潜在关联概念(connection_hints)、标签交集与机制语义，查找最相关的 3~8 张关联卡片，帮助 Agent 顺藤摸瓜拼接论证网络。",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "目标基准卡片的唯一 ID",
        },
        limit: {
          type: "number",
          description: "最多返回关联卡片数量，默认 5（1~10）",
        },
      },
      required: ["card_id"],
    },
  },
  {
    name: "list_tags_and_concepts",
    description:
      "获取全局知识库的高频领域标签、核心概念词云（从卡片关联线索 connection_hints 中提炼）及各自分布热度，帮助 Agent 秒懂知识库的认知分布图谱。",
    inputSchema: {
      type: "object",
      properties: {
        kb_id: {
          type: "string",
          description: "可选：限定特定知识库 ID",
        },
        limit: {
          type: "number",
          description: "最多返回标签/概念数量，默认 30",
        },
      },
    },
  },

  // ================= 4. 选题灵感与成稿工坊层 =================
  {
    name: "list_topics",
    description:
      "获取选题雷达灵感库中的选题。支持按意图搜索、随机换一批、排除已读选题、按分值/时间排序及内联带回引用的原子论据卡片。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "可选：按关键词或主题意图搜索选题（如：'认知负荷'、'AI应用'）",
        },
        status: {
          type: "string",
          enum: ["idea", "used", "all"],
          description: "选题状态：'idea'(待创作，默认)、'used'(已成稿)、'all'(全部)",
        },
        angle_type: {
          type: "string",
          enum: ["paradox", "intersection", "deep_dive", "all"],
          description: "碰撞策略：'paradox'(反差碰撞)、'intersection'(跨界同构)、'deep_dive'(专题纵深)、'all'(全部)",
        },
        exclude_ids: {
          type: "array",
          items: { type: "string" },
          description: "可选：排除已看或已推荐过的 topic_id 列表，实现'换一批'探索",
        },
        order_by: {
          type: "string",
          enum: ["recent", "score", "random"],
          description: "排序方式：'recent'(最新，默认)、'score'(高分优先)、'random'(随机抽样碰撞)",
        },
        min_score: {
          type: "number",
          description: "可选：筛选最低契合分值（如：90）",
        },
        include_cards: {
          type: "boolean",
          description: "是否直接内联返回该选题引用的原子知识卡片核心论点（默认 false）",
        },
        limit: {
          type: "number",
          description: "最多返回条数，默认 6（1~50）",
        },
        offset: {
          type: "number",
          description: "分页偏移量，默认 0",
        },
      },
    },
  },
  {
    name: "list_recent_works",
    description:
      "获取创作者近期已成稿的作品列表（包含标题、字数、正文摘要及完整母稿），供 Agent 学习并精准对齐创作者文风调性与行文节奏。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "可选：按作品标题或正文关键词搜索历史作品",
        },
        platform: {
          type: "string",
          description: "可选的分发平台或技能过滤（如：'wechat', 'xiaohongshu', 'zhihu', 'x_thread', 'master'）",
        },
        include_full_content: {
          type: "boolean",
          description: "是否返回完整正文母稿（默认 false；当 limit 较小时设为 true 可作为 Few-Shot 文风范例）",
        },
        limit: {
          type: "number",
          description: "最多返回作品篇数，默认 5 篇（1~20）",
        },
      },
    },
  },
];

/** 暴露的只读 Resources */
export const MCP_RESOURCES: McpResource[] = [
  {
    uri: "inkcraft://radar/top-ideas",
    name: "当前选题雷达 Top 5 候选灵感",
    description: "当前选题库中评分最高且尚未动笔的 5 个优质碰撞选题",
    mimeType: "application/json",
  },
  {
    uri: "inkcraft://stats/summary",
    name: "InkCraft 知识库全局统计摘要",
    description: "包含卡片总数、选题储备、成稿总数等全局数据",
    mimeType: "application/json",
  },
];

/** 辅助函数：根据单张或多张卡片 ID 从数据库高保真读取 */
function fetchCardDetailsByIds(cardIds: string[]): Array<{
  card_id: string;
  document_id: string;
  note_title: string;
  kb_id: string;
  claim: string;
  hook: string;
  mechanism: string[];
  boundary: string;
  tags: string[];
  connection_hints: string[];
  full_content_md: string;
  created_at: string;
}> {
  const cleanIds = Array.from(
    new Set(cardIds.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)),
  );
  if (cleanIds.length === 0) return [];

  const db = getDb();
  const placeholders = cleanIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT c.id, c.document_id, c.content_md, c.created_at,
              ki.title AS note_title, ki.tags AS note_tags_raw, ki.kb_id
       FROM knowledge_cards c
       JOIN knowledge_items ki ON ki.id = c.document_id
       WHERE c.id IN (${placeholders})`,
    )
    .all(...cleanIds) as Array<{
    id: string;
    document_id: string;
    content_md: string;
    created_at: string;
    note_title: string | null;
    note_tags_raw: string | null;
    kb_id: string | null;
  }>;

  return rows.map((r) => {
    const fields = parseCardFields(r.content_md);
    let tags: string[] = [];
    if (r.note_tags_raw) {
      try {
        const parsed = JSON.parse(r.note_tags_raw);
        if (Array.isArray(parsed)) {
          tags = parsed.filter((t): t is string => typeof t === "string" && !!t.trim());
        }
      } catch {
        tags = r.note_tags_raw.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
      }
    }

    const connectionHints: string[] = Array.isArray(fields.frontmatter?.connection_hints)
      ? fields.frontmatter.connection_hints
      : [];

    return {
      card_id: r.id,
      document_id: r.document_id,
      note_title: r.note_title || "未命名笔记",
      kb_id: r.kb_id || "default",
      claim: fields.claim || fields.frontmatter?.title || "原子卡片",
      hook: fields.cut || fields.quote || "",
      mechanism: fields.parts?.map((p) => p.text) || [],
      boundary: fields.notApplicable || fields.applicable || "",
      tags,
      connection_hints: connectionHints,
      full_content_md: r.content_md,
      created_at: r.created_at,
    };
  });
}

/** 执行具体 Tool 调用 */
export async function executeMcpTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  switch (name) {
    // ================= 1. 原子知识卡片层 =================
    case "search_cards_by_query": {
      const query = typeof args.query === "string" ? args.query : "";
      const tags = Array.isArray(args.tags)
        ? (args.tags.filter((t) => typeof t === "string") as string[])
        : undefined;
      const kbId = typeof args.kb_id === "string" && args.kb_id.trim() ? args.kb_id.trim() : undefined;
      const includeContent = Boolean(args.include_content);
      const limit = typeof args.limit === "number" ? Math.min(30, Math.max(1, args.limit)) : 8;

      const searchRes = searchCardsByRelevance({
        query,
        tags,
        kbId,
        includeContent,
        limit,
      });

      return {
        query: searchRes.query,
        total_matched: searchRes.totalMatched,
        cards: searchRes.results.map((r) => ({
          card_id: r.cardId,
          relevance_score: r.relevanceScore,
          matched_reason: r.matchedReason,
          claim: r.claim,
          hook: r.hook,
          mechanism: r.mechanism,
          boundary: r.boundary,
          tags: r.tags,
          source_note: r.noteTitle,
          ...(includeContent && r.fullContentMd ? { full_content_md: r.fullContentMd } : {}),
        })),
      };
    }

    case "get_card_detail": {
      const singleId = typeof args.card_id === "string" ? args.card_id.trim() : "";
      const batchIds = Array.isArray(args.card_ids)
        ? (args.card_ids.filter((id) => typeof id === "string" && id.trim()) as string[])
        : [];

      const queryIds = Array.from(new Set([...(singleId ? [singleId] : []), ...batchIds]));
      if (queryIds.length === 0) {
        throw new Error("缺少必需参数: 请提供 card_id 或 card_ids 数组");
      }

      const cardResults = fetchCardDetailsByIds(queryIds);

      // 如果调用方只查询单张卡片且未传 card_ids 数组，保持单卡对象返回（向下兼容）
      if (singleId && batchIds.length === 0) {
        const target = cardResults.find((c) => c.card_id === singleId);
        if (!target) {
          throw new Error(`未找到 ID 为 ${singleId} 的卡片`);
        }
        return target;
      }

      return {
        total: cardResults.length,
        cards: cardResults,
      };
    }

    // ================= 2. 原始文档与长文语料层 =================
    case "list_knowledge_bases": {
      const db = getDb();
      const rows = db.prepare(`
        SELECT kb.id, kb.name, kb.description, kb.is_default, kb.created_at,
               (SELECT COUNT(*) FROM knowledge_items ki WHERE ki.kb_id = kb.id AND ki.chunk_index IS NULL) as document_count,
               (SELECT COUNT(*) FROM knowledge_cards kc JOIN knowledge_items ki ON ki.id = kc.document_id WHERE ki.kb_id = kb.id) as card_count
        FROM knowledge_bases kb
        ORDER BY kb.is_default DESC, kb.created_at ASC
      `).all() as Array<{
        id: string;
        name: string;
        description: string | null;
        is_default: number;
        created_at: string;
        document_count: number;
        card_count: number;
      }>;

      return {
        total: rows.length,
        knowledge_bases: rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description || "",
          is_default: Boolean(r.is_default),
          document_count: r.document_count,
          card_count: r.card_count,
          created_at: r.created_at,
        })),
      };
    }

    case "search_documents": {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      const kbId = typeof args.kb_id === "string" && args.kb_id.trim() ? args.kb_id.trim() : undefined;
      const tagsFilter = Array.isArray(args.tags)
        ? (args.tags.filter((t) => typeof t === "string" && t.trim()) as string[])
        : undefined;
      const limit = typeof args.limit === "number" ? Math.min(30, Math.max(1, args.limit)) : 8;

      const db = getDb();
      const hitMap = new Map<string, string | null>();

      let rows: Array<{
        id: string;
        kb_id: string;
        title: string | null;
        content: string;
        category: string | null;
        tags: string | null;
        created_at: string;
        updated_at: string;
      }> = [];

      if (query) {
        // 1. 先用 FTS5 全文搜索获取命中及高亮 snippet
        const ftsHits = ftsSearchNotes(db, query, limit * 3);
        let candidateIds: string[] = [];

        if (ftsHits && ftsHits.length > 0) {
          for (const hit of ftsHits) {
            hitMap.set(hit.id, hit.snippet);
            candidateIds.push(hit.id);
          }
        } else {
          // 降级使用 LIKE 搜索
          const likeHits = likeSearchNotes(db, query, limit * 3);
          for (const hit of likeHits) {
            hitMap.set(hit.id, null);
            candidateIds.push(hit.id);
          }
        }

        if (candidateIds.length === 0) {
          return {
            query,
            total_matched: 0,
            documents: [],
          };
        }

        const placeholders = candidateIds.map(() => "?").join(", ");
        let sql = `
          SELECT id, kb_id, title, content, category, tags, created_at, updated_at
          FROM knowledge_items
          WHERE id IN (${placeholders}) AND chunk_index IS NULL
        `;
        const params: any[] = [...candidateIds];

        if (kbId) {
          sql += ` AND kb_id = ?`;
          params.push(kbId);
        }

        rows = db.prepare(sql).all(...params) as typeof rows;
      } else {
        // 无 query 时直接按条件筛选或列出最新文档
        const conditions = ["chunk_index IS NULL"];
        const params: any[] = [];
        if (kbId) {
          conditions.push("kb_id = ?");
          params.push(kbId);
        }
        params.push(limit * 3);
        rows = db.prepare(`
          SELECT id, kb_id, title, content, category, tags, created_at, updated_at
          FROM knowledge_items
          WHERE ${conditions.join(" AND ")}
          ORDER BY created_at DESC
          LIMIT ?
        `).all(...params) as typeof rows;
      }

      // 解析 tags 并过滤
      const filtered = rows.filter((r) => {
        if (!tagsFilter || tagsFilter.length === 0) return true;
        let itemTags: string[] = [];
        if (r.tags) {
          try {
            const p = JSON.parse(r.tags);
            if (Array.isArray(p)) itemTags = p;
          } catch {
            itemTags = r.tags.split(/[,，]/);
          }
        }
        return tagsFilter.some((t) => itemTags.some((it) => it.toLowerCase().includes(t.toLowerCase())));
      });

      const docs = filtered.slice(0, limit).map((r) => {
        const snippet = hitMap.get(r.id) || r.content.replace(/\s+/g, " ").slice(0, 200) + "...";
        let parsedTags: string[] = [];
        if (r.tags) {
          try {
            const p = JSON.parse(r.tags);
            if (Array.isArray(p)) parsedTags = p.filter((t) => typeof t === "string");
          } catch {
            parsedTags = r.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
          }
        }

        return {
          document_id: r.id,
          kb_id: r.kb_id || "default",
          title: r.title || "未命名笔记",
          category: r.category || "通用",
          tags: parsedTags,
          snippet,
          word_count: r.content.length,
          created_at: r.created_at,
        };
      });

      return {
        query,
        total_matched: docs.length,
        documents: docs,
      };
    }

    case "get_document_detail": {
      const documentId = typeof args.document_id === "string" ? args.document_id.trim() : "";
      if (!documentId) {
        throw new Error("缺少必需参数: document_id");
      }

      const db = getDb();
      const doc = db.prepare(`
        SELECT id, kb_id, title, content, category, tags, created_at, updated_at
        FROM knowledge_items
        WHERE id = ?
      `).get(documentId) as {
        id: string;
        kb_id: string;
        title: string | null;
        content: string;
        category: string | null;
        tags: string | null;
        created_at: string;
        updated_at: string;
      } | undefined;

      if (!doc) {
        throw new Error(`未找到 ID 为 ${documentId} 的文档或笔记`);
      }

      // 查询该母档提取的所有卡片
      const cardRows = db.prepare(`
        SELECT id, content_md, created_at
        FROM knowledge_cards
        WHERE document_id = ?
        ORDER BY created_at ASC
      `).all(documentId) as Array<{ id: string; content_md: string; created_at: string }>;

      const extractedCards = cardRows.map((c) => {
        const f = parseCardFields(c.content_md);
        return {
          card_id: c.id,
          claim: f.claim || f.frontmatter?.title || "原子卡片",
          hook: f.cut || f.quote || "",
          mechanism: f.parts?.[0]?.text || "",
          boundary: f.notApplicable || f.applicable || "",
        };
      });

      let tags: string[] = [];
      if (doc.tags) {
        try {
          const parsed = JSON.parse(doc.tags);
          if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === "string");
        } catch {
          tags = doc.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
        }
      }

      return {
        document_id: doc.id,
        kb_id: doc.kb_id || "default",
        title: doc.title || "未命名笔记",
        category: doc.category || "通用",
        tags,
        content_md: doc.content,
        word_count: doc.content.length,
        extracted_cards: extractedCards,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      };
    }

    // ================= 3. 网状关联与概念发现层 =================
    case "find_related_cards": {
      const cardId = typeof args.card_id === "string" ? args.card_id.trim() : "";
      if (!cardId) {
        throw new Error("缺少必需参数: card_id");
      }
      const limit = typeof args.limit === "number" ? Math.min(10, Math.max(1, args.limit)) : 5;

      const allCards = getAllCards();
      const target = allCards.find((c) => c.id === cardId);
      if (!target) {
        throw new Error(`未找到 ID 为 ${cardId} 的目标基准卡片`);
      }

      const targetFields = parseCardFields(target.content_md);
      const targetTags: string[] = Array.isArray(target.note_tags) ? target.note_tags : [];
      const targetHints: string[] = Array.isArray(targetFields.frontmatter?.connection_hints)
        ? targetFields.frontmatter.connection_hints
        : [];
      const targetClaim = targetFields.claim || targetFields.frontmatter?.title || "";

      const targetCandidate: RadarCardCandidate = {
        id: target.id,
        docId: target.document_id,
        title: targetClaim,
        hook: targetFields.cut || targetFields.quote || "",
        mechanism: targetFields.parts?.[0]?.text || "",
        boundary: targetFields.notApplicable || targetFields.applicable || "",
        tags: targetTags,
        noteTitle: target.note_title || "",
      };

      // 遍历所有其他卡片计算网状关联分
      const relatedList: Array<{
        card_id: string;
        claim: string;
        hook: string;
        mechanism: string;
        boundary: string;
        relation_reason: string;
        similarity_score: number;
        tags: string[];
        source_note: string;
      }> = [];

      for (const card of allCards) {
        if (card.id === cardId) continue; // 排除自身

        const cFields = parseCardFields(card.content_md);
        const cTags: string[] = Array.isArray(card.note_tags) ? card.note_tags : [];
        const cHints: string[] = Array.isArray(cFields.frontmatter?.connection_hints)
          ? cFields.frontmatter.connection_hints
          : [];
        const cClaim = cFields.claim || cFields.frontmatter?.title || "原子卡片";
        const cMechanism = cFields.parts?.[0]?.text || "";
        const cBoundary = cFields.notApplicable || cFields.applicable || "";
        const cHook = cFields.cut || cFields.quote || "";

        const cCandidate: RadarCardCandidate = {
          id: card.id,
          docId: card.document_id,
          title: cClaim,
          hook: cHook,
          mechanism: cMechanism,
          boundary: cBoundary,
          tags: cTags,
          noteTitle: card.note_title || "",
        };

        const reasons: string[] = [];
        let score = 0;

        // 1. Connection Hints 概念交叉碰撞（权重最高）
        const matchedHints: string[] = [];
        for (const hint of targetHints) {
          if (!hint) continue;
          const hintLower = hint.toLowerCase();
          if (
            cClaim.toLowerCase().includes(hintLower) ||
            cMechanism.toLowerCase().includes(hintLower) ||
            cTags.some((t) => t.toLowerCase().includes(hintLower))
          ) {
            matchedHints.push(hint);
          }
        }
        for (const ch of cHints) {
          if (!ch) continue;
          const chLower = ch.toLowerCase();
          if (
            targetClaim.toLowerCase().includes(chLower) ||
            (targetCandidate.mechanism || "").toLowerCase().includes(chLower)
          ) {
            matchedHints.push(ch);
          }
        }

        if (matchedHints.length > 0) {
          const uniqueHints = Array.from(new Set(matchedHints));
          score += 45 + uniqueHints.length * 15;
          reasons.push(`核心概念呼应 [${uniqueHints.slice(0, 2).join(", ")}]`);
        }

        // 2. 领域标签交集
        const tagOverlap = targetTags.filter((tt) =>
          cTags.some((ct) => ct.toLowerCase() === tt.toLowerCase()),
        );
        if (tagOverlap.length > 0) {
          score += tagOverlap.length * 12;
          reasons.push(`领域标签重叠 [${tagOverlap.slice(0, 2).join(", ")}]`);
        }

        // 3. 语义 Jaccard 相似度
        const jaccard = computeCardJaccardSimilarity(targetCandidate, cCandidate);
        if (jaccard > 0.08) {
          score += Math.round(jaccard * 40);
          if (reasons.length === 0) {
            reasons.push("语义与论证机理相关");
          }
        }

        const normalizedScore = Math.min(100, Math.max(10, score));
        if (reasons.length > 0) {
          relatedList.push({
            card_id: card.id,
            claim: cClaim,
            hook: cHook,
            mechanism: cMechanism,
            boundary: cBoundary,
            relation_reason: reasons.join("； "),
            similarity_score: normalizedScore,
            tags: cTags,
            source_note: card.note_title || "关联笔记",
          });
        }
      }

      relatedList.sort((a, b) => b.similarity_score - a.similarity_score);

      return {
        source_card: {
          card_id: target.id,
          claim: targetClaim,
          tags: targetTags,
          connection_hints: targetHints,
        },
        total_related: relatedList.length,
        related_cards: relatedList.slice(0, limit),
      };
    }

    case "list_tags_and_concepts": {
      const kbId = typeof args.kb_id === "string" && args.kb_id.trim() ? args.kb_id.trim() : undefined;
      const limit = typeof args.limit === "number" ? Math.min(100, Math.max(1, args.limit)) : 30;

      const allCards = getAllCards();
      const tagCountMap = new Map<string, number>();
      const conceptCountMap = new Map<string, number>();

      for (const card of allCards) {
        if (kbId && (card as any).kb_id && (card as any).kb_id !== kbId) continue;

        const tags: string[] = Array.isArray(card.note_tags) ? card.note_tags : [];
        for (const t of tags) {
          const clean = t.trim();
          if (clean) tagCountMap.set(clean, (tagCountMap.get(clean) || 0) + 1);
        }

        const fields = parseCardFields(card.content_md);
        const hints: string[] = Array.isArray(fields.frontmatter?.connection_hints)
          ? fields.frontmatter.connection_hints
          : [];
        for (const h of hints) {
          const clean = typeof h === "string" ? h.trim() : "";
          if (clean && clean.length >= 2) {
            conceptCountMap.set(clean, (conceptCountMap.get(clean) || 0) + 1);
          }
        }
      }

      const topTags = Array.from(tagCountMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      const topConcepts = Array.from(conceptCountMap.entries())
        .map(([concept, count]) => ({ concept, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return {
        total_tags: tagCountMap.size,
        total_concepts: conceptCountMap.size,
        top_tags: topTags,
        top_concepts: topConcepts,
      };
    }

    // ================= 4. 选题灵感与成稿工坊层 =================
    case "list_topics": {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      const status = typeof args.status === "string" ? (args.status as "idea" | "used" | "all") : "idea";
      const angleType = typeof args.angle_type === "string" ? (args.angle_type as any) : "all";
      const excludeIds = Array.isArray(args.exclude_ids)
        ? (args.exclude_ids.filter((id) => typeof id === "string" && id.trim()) as string[])
        : undefined;
      const orderBy = typeof args.order_by === "string" ? (args.order_by as "recent" | "score" | "random") : "recent";
      const minScore = typeof args.min_score === "number" ? args.min_score : undefined;
      const includeCards = Boolean(args.include_cards);
      const limit = typeof args.limit === "number" ? Math.min(50, Math.max(1, args.limit)) : 6;
      const offset = typeof args.offset === "number" ? Math.max(0, args.offset) : 0;

      const topics = getTopicsFromDb({
        search: query || undefined,
        status: status === "all" ? undefined : status,
        angleType: angleType === "all" ? undefined : angleType,
        excludeIds,
        orderBy,
        minScore,
        limit,
        offset,
      });

      // 若指定 include_cards，则内联提取该批选题引用的原子卡片
      let cardsDetailMap = new Map<string, ReturnType<typeof fetchCardDetailsByIds>[0]>();
      if (includeCards && topics.length > 0) {
        const allReferencedCardIds = Array.from(
          new Set(
            topics.flatMap((t) =>
              (t.matchedCards || []).map((c: any) =>
                typeof c === "string" ? c : c?.id || "",
              ),
            ).filter(Boolean),
          ),
        );
        if (allReferencedCardIds.length > 0) {
          const loadedCards = fetchCardDetailsByIds(allReferencedCardIds);
          cardsDetailMap = new Map(loadedCards.map((c) => [c.card_id, c]));
        }
      }

      return {
        total: topics.length,
        query: query || null,
        topics: topics.map((t) => {
          const rawCards = t.matchedCards || [];
          const referencedCardIds = rawCards.map((c: any) =>
            typeof c === "string" ? c : c?.id || "",
          ).filter(Boolean);

          const referencedDetails = includeCards
            ? referencedCardIds
                .map((cid) => cardsDetailMap.get(cid))
                .filter(Boolean)
                .map((c) => ({
                  card_id: c!.card_id,
                  claim: c!.claim,
                  hook: c!.hook,
                  mechanism: c!.mechanism,
                  boundary: c!.boundary,
                  source_note: c!.note_title,
                }))
            : undefined;

          return {
            topic_id: t.id,
            title: t.title,
            title_options: t.titleOptions || [t.title],
            angle_type: t.angleType || "paradox",
            score: t.score || 90,
            score_tag: t.scoreTag,
            core_argument: t.coreArgument || t.angle || "",
            hook: t.hook || "",
            target_skill: t.targetSkill,
            status: t.status,
            outline_steps: t.outlineStructured || (t.outline || []).map((step, idx) => ({
              step: idx + 1,
              guideline: step,
              referenced_card_id: null,
            })),
            referenced_cards: referencedCardIds,
            ...(includeCards ? { referenced_cards_detail: referencedDetails } : {}),
            created_at: t.createdAt,
          };
        }),
      };
    }

    case "list_recent_works": {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      const platform = typeof args.platform === "string" && args.platform.trim() !== "all" ? args.platform.trim() : "";
      const includeFullContent = Boolean(args.include_full_content);
      const limit = typeof args.limit === "number" ? Math.min(20, Math.max(1, args.limit)) : 5;

      const db = getDb();
      const conditions: string[] = ["(length(p.master_content) > 50 OR p.current_stage = 'completed')"];
      const params: Array<string | number> = [];

      if (query) {
        conditions.push("(p.title LIKE ? OR p.master_content LIKE ?)");
        const kw = `%${query}%`;
        params.push(kw, kw);
      }

      if (platform) {
        conditions.push("p.target_skill = ?");
        params.push(platform);
      }

      const whereClause = conditions.join(" AND ");
      params.push(limit);

      const rows = db.prepare(`
        SELECT p.id, p.title, p.current_stage, p.master_content, p.selected_topic, p.target_skill, p.updated_at
        FROM pipeline_projects p
        WHERE ${whereClause}
        ORDER BY p.updated_at DESC
        LIMIT ?
      `).all(...params) as Array<{
        id: string;
        title: string;
        current_stage: string;
        master_content: string;
        selected_topic: string | null;
        target_skill?: string | null;
        updated_at: string;
      }>;

      return {
        total: rows.length,
        works: rows.map((r) => {
          const firstLine = (r.master_content || "").split("\n")[0] || "";
          const displayTitle = r.title && r.title !== "未命名成稿"
            ? r.title
            : firstLine.replace(/^#*\s*/, "").slice(0, 40) || "成稿作品";
          const snippet = (r.master_content || "").slice(0, 500);

          return {
            work_id: r.id,
            title: displayTitle,
            stage: r.current_stage,
            target_skill: r.target_skill || "master",
            word_count: (r.master_content || "").length,
            content_snippet: snippet,
            ...(includeFullContent ? { full_content_md: r.master_content || "" } : {}),
            updated_at: r.updated_at,
          };
        }),
      };
    }

    default:
      throw new Error(`未知 MCP 工具: ${name}`);
  }
}

/** 读取指定 Resource 内容 */
export async function readMcpResource(uri: string): Promise<string> {
  if (uri === "inkcraft://radar/top-ideas") {
    const topIdeas = getTopicsFromDb({ status: "idea", limit: 5 });
    return JSON.stringify(topIdeas, null, 2);
  }

  if (uri === "inkcraft://stats/summary") {
    const topicStats = getTopicStats();
    const db = getDb();
    const cardsCount = (db.prepare("SELECT count(*) as count FROM knowledge_cards").get() as { count: number }).count;
    const worksCount = (db.prepare(`
      SELECT count(*) as count
      FROM pipeline_projects
      WHERE length(master_content) > 50 OR current_stage = 'completed'
    `).get() as { count: number }).count;

    return JSON.stringify(
      {
        total_atomic_cards: cardsCount,
        total_topics_in_radar: topicStats.total,
        active_ideas_to_write: topicStats.ideas,
        completed_works_count: worksCount,
        last_mining_at: topicStats.lastScannedAt,
      },
      null,
      2,
    );
  }

  throw new Error(`未知 Resource URI: ${uri}`);
}

/**
 * 统一处理 MCP JSON-RPC 2.0 请求
 */
export async function handleMcpJsonRpc(
  body: Record<string, any>,
  clientName = "Unknown Agent",
): Promise<Record<string, any>> {
  const { id = null, method, params = {} } = body;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
          },
          serverInfo: {
            name: "inkcraft-mcp-server",
            version: "1.0.0",
            authenticatedAs: clientName,
          },
        },
      };

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: MCP_TOOLS,
        },
      };

    case "tools/call": {
      const toolName = params.name;
      const toolArgs = params.arguments || {};
      try {
        const data = await executeMcpTool(toolName, toolArgs);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
            isError: false,
          },
        };
      } catch (err: any) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Error executing tool ${toolName}: ${err?.message || String(err)}`,
              },
            ],
            isError: true,
          },
        };
      }
    }

    case "resources/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          resources: MCP_RESOURCES,
        },
      };

    case "resources/read": {
      const uri = params.uri;
      try {
        const text = await readMcpResource(uri);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text,
              },
            ],
          },
        };
      } catch (err: any) {
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32602,
            message: err?.message || "Resource read error",
          },
        };
      }
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
  }
}
