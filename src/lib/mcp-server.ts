import { searchCardsByRelevance } from "./cards-search";
import { getAllCards } from "./cards";
import { parseCardFields } from "./card-md";
import { getTopicsFromDb, getTopicStats } from "./topics";
import { getDb } from "./db";

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

/** 暴露给外部 Agent 的 4 大核心只读 Tools */
export const MCP_TOOLS: McpTool[] = [
  {
    name: "search_cards_by_query",
    description:
      "【最常用】根据自然语言意图或关键词检索知识库中高匹配的原子卡片。返回核心论点(claim)、底层推导(mechanism)、适用边界(boundary)、匹配分值(relevanceScore)与命中原因(matchedReason)。",
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
        limit: {
          type: "number",
          description: "最多返回卡片数量，默认 8 条",
        },
      },
    },
  },
  {
    name: "get_card_detail",
    description:
      "获取指定 card_id 的原子知识卡片完整内容（包含完整 Markdown 正文、所属母档标题与全部元数据）。",
    inputSchema: {
      type: "object",
      properties: {
        card_id: {
          type: "string",
          description: "卡片的唯一 ID（如：card_abc123）",
        },
      },
      required: ["card_id"],
    },
  },
  {
    name: "list_topics",
    description:
      "获取选题雷达灵感库中的选题。返回 3 选 1 标题矩阵、核心论证切角(angle)、首句钩子(hook)、结构化递进大纲及绑定的卡片引用(referenced_card_id)。",
    inputSchema: {
      type: "object",
      properties: {
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
        limit: {
          type: "number",
          description: "最多返回条数，默认 10",
        },
      },
    },
  },
  {
    name: "list_recent_works",
    description:
      "获取创作者近期已成稿的作品列表（包含作品标题、分发平台类型、正文前 500 字摘要及创作时间），供 Agent 学习并对齐创作者文风调性。",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "最多返回作品篇数，默认 5 篇",
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

/** 执行具体 Tool 调用 */
export async function executeMcpTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  switch (name) {
    case "search_cards_by_query": {
      const query = typeof args.query === "string" ? args.query : "";
      const tags = Array.isArray(args.tags)
        ? (args.tags.filter((t) => typeof t === "string") as string[])
        : undefined;
      const limit = typeof args.limit === "number" ? Math.min(30, Math.max(1, args.limit)) : 8;

      const searchRes = searchCardsByRelevance({ query, tags, limit });
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
        })),
      };
    }

    case "get_card_detail": {
      const cardId = typeof args.card_id === "string" ? args.card_id.trim() : "";
      if (!cardId) {
        throw new Error("缺少必需参数: card_id");
      }

      const allCards = getAllCards();
      const target = allCards.find((c) => c.id === cardId);
      if (!target) {
        throw new Error(`未找到 ID 为 ${cardId} 的卡片`);
      }

      const fields = parseCardFields(target.content_md);
      const cardTags: string[] = Array.isArray(target.note_tags) ? target.note_tags : [];
      return {
        card_id: target.id,
        document_id: target.document_id,
        note_title: target.note_title || "未命名笔记",
        claim: fields.claim || fields.frontmatter?.title || "原子卡片",
        hook: fields.cut || fields.quote || "",
        mechanism: fields.parts?.map((p) => p.text) || [],
        boundary: fields.notApplicable || fields.applicable || "",
        tags: cardTags,
        full_content_md: target.content_md,
        created_at: target.created_at,
      };
    }

    case "list_topics": {
      const status = typeof args.status === "string" ? (args.status as "idea" | "used" | "all") : "idea";
      const angleType = typeof args.angle_type === "string" ? (args.angle_type as any) : "all";
      const limit = typeof args.limit === "number" ? Math.min(50, Math.max(1, args.limit)) : 10;

      const topics = getTopicsFromDb({
        status: status === "all" ? undefined : status,
        angleType: angleType === "all" ? undefined : angleType,
        limit,
      });

      return {
        total: topics.length,
        topics: topics.map((t) => ({
          topic_id: t.id,
          title: t.title,
          title_options: t.titleOptions || [t.title],
          angle_type: t.angleType || "paradox",
          score: t.score || 90,
          core_argument: t.coreArgument || t.angle || "",
          hook: t.hook || "",
          target_skill: t.targetSkill,
          status: t.status,
          outline_steps: t.outlineStructured || (t.outline || []).map((step, idx) => ({
            step: idx + 1,
            guideline: step,
            referenced_card_id: null,
          })),
          referenced_cards: t.matchedCards || [],
          created_at: t.createdAt,
        })),
      };
    }

    case "list_recent_works": {
      const limit = typeof args.limit === "number" ? Math.min(20, Math.max(1, args.limit)) : 5;
      const db = getDb();
      const rows = db.prepare(`
        SELECT p.id, p.title, p.current_stage, p.master_content, p.selected_topic, p.updated_at
        FROM pipeline_projects p
        WHERE length(p.master_content) > 50 OR p.current_stage = 'completed'
        ORDER BY p.updated_at DESC
        LIMIT ?
      `).all(limit) as Array<{
        id: string;
        title: string;
        current_stage: string;
        master_content: string;
        selected_topic: string | null;
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
            word_count: (r.master_content || "").length,
            content_snippet: snippet,
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
    const allCards = getAllCards();
    const db = getDb();
    const worksCount = (db.prepare(`
      SELECT count(*) as count
      FROM pipeline_projects
      WHERE length(master_content) > 50 OR current_stage = 'completed'
    `).get() as { count: number }).count;

    return JSON.stringify(
      {
        total_atomic_cards: allCards.length,
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
