import { extractFrontmatter } from "@/lib/card-md";
import type { KnowledgeCard } from "@/lib/types";

export interface CardListItem extends KnowledgeCard {
  note_title: string | null;
  note_tags?: string[];
  updated_at: string;
}

export interface ParsedCardItem {
  id: string;
  documentId: string;
  noteTitle: string;
  updatedAt: string;
  title: string;
  tags: string[];
  hook: string;
  connectionHints: string[];
  type: string;
  body: string;
  summary: string;
  raw: CardListItem;
}

/** 格式化日期为短格式 */
export function formatCardDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

/** 深度解析卡片 Markdown 与 Frontmatter，优先继承源笔记的权威领域标签 */
export function parseCardItem(card: CardListItem): ParsedCardItem {
  const { frontmatter, body } = extractFrontmatter(card.content_md);

  let title = frontmatter.title;
  let hook = frontmatter.hook || "";

  // 权威受控标签：优先使用源笔记的领域标签体系，杜绝 AI 自由发散导致的标签膨胀失效
  const noteTags = (card.note_tags || []).filter(Boolean);
  const tags = noteTags.length > 0 ? noteTags : (frontmatter.tags || []).filter(Boolean);

  const connectionHints = frontmatter.connection_hints || [];
  const type = frontmatter.type || "permanent";

  // 若无 frontmatter title，从正文中提炼有效断言
  if (!title || title === "提炼知识卡片") {
    const isHeading = (l: string) => /^#{1,6}\s/.test(l);
    const plain = (l: string) =>
      l
        .replace(/^>\s*/, "")
        .replace(/^[-*+]\s+\[[ xX]\]\s*/, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/\*\*/g, "")
        .trim();

    for (const raw of body.split("\n")) {
      const line = raw.trim();
      if (!line || isHeading(line)) continue;
      const text = plain(line);
      if (!text || text === "—") continue;
      if (!title) {
        title = text;
        break;
      }
    }
  }

  // 提取一段 60~120 字的机制摘要供卡片预览
  let summary = "";
  const lines = body.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("---")) continue;
    const cleanText = trimmed
      .replace(/^>\s*/, "")
      .replace(/^[-*+]\s+/, "")
      .replace(/\*\*/g, "")
      .replace(/`([^`]+)`/g, "$1");
    if (cleanText.length > 10) {
      summary = cleanText;
      break;
    }
  }

  return {
    id: card.id,
    documentId: card.document_id,
    noteTitle: card.note_title || "未命名笔记",
    updatedAt: card.updated_at,
    title: title || "原子知识卡片",
    tags,
    hook,
    connectionHints,
    type,
    body,
    summary: summary || hook || "点击查看卡片详情与核心逻辑...",
    raw: card,
  };
}
