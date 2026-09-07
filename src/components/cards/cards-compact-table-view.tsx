"use client";

import {
  ArrowUpDown,
  BookOpen,
  Calendar,
  Copy,
  PenLine,
  Tag,
  Trash2,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCardDate, type ParsedCardItem } from "./card-utils";

interface CardsCompactTableViewProps {
  cards: ParsedCardItem[];
  onSelectCard: (card: ParsedCardItem) => void;
  onWriteWithCard: (card: ParsedCardItem) => void;
  onDeleteCard: (card: ParsedCardItem) => void;
  onSelectTag?: (tag: string) => void;
  selectedTag?: string | null;
}

type SortField = "date" | "title" | "note";
type SortOrder = "asc" | "desc";

export function CardsCompactTableView({
  cards,
  onSelectCard,
  onWriteWithCard,
  onDeleteCard,
  onSelectTag,
  selectedTag,
}: CardsCompactTableViewProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") {
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (sortField === "title") {
        cmp = a.title.localeCompare(b.title, "zh-CN");
      } else if (sortField === "note") {
        cmp = a.noteTitle.localeCompare(b.noteTitle, "zh-CN");
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [cards, sortField, sortOrder]);

  const handleCopy = (e: React.MouseEvent, card: ParsedCardItem) => {
    e.stopPropagation();
    navigator.clipboard.writeText(card.raw.content_md);
    setCopiedId(card.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          {/* 表头 */}
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-medium text-muted-foreground select-none">
              <th
                onClick={() => handleSort("title")}
                className="py-3 pl-4 pr-3 cursor-pointer hover:text-foreground transition-colors min-w-[280px]"
              >
                <div className="flex items-center gap-1">
                  <span>断言式标题 / 传播切口</span>
                  <ArrowUpDown className="size-3" />
                </div>
              </th>
              <th className="py-3 px-3 min-w-[160px]">标签 / 概念</th>
              <th
                onClick={() => handleSort("note")}
                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors min-w-[160px]"
              >
                <div className="flex items-center gap-1">
                  <span>来源笔记</span>
                  <ArrowUpDown className="size-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort("date")}
                className="py-3 px-3 cursor-pointer hover:text-foreground transition-colors min-w-[100px]"
              >
                <div className="flex items-center gap-1">
                  <span>更新时间</span>
                  <ArrowUpDown className="size-3" />
                </div>
              </th>
              <th className="py-3 pr-4 pl-3 text-right min-w-[120px]">快捷操作</th>
            </tr>
          </thead>

          {/* 表体 */}
          <tbody className="divide-y divide-border/40">
            {sortedCards.map((card) => (
              <tr
                key={card.id}
                onClick={() => onSelectCard(card)}
                className="group transition-colors hover:bg-muted/40 cursor-pointer"
              >
                {/* 标题 & Hook */}
                <td className="py-3 pl-4 pr-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-xs leading-snug group-hover:text-primary transition-colors line-clamp-1">
                      {card.title}
                    </p>
                    {card.hook ? (
                      <p className="line-clamp-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                        <Zap className="size-2.5 shrink-0" />
                        {card.hook}
                      </p>
                    ) : (
                      <p className="line-clamp-1 text-[11px] text-muted-foreground/80">
                        {card.summary}
                      </p>
                    )}
                  </div>
                </td>

                {/* 标签 */}
                <td className="py-3 px-3">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {card.tags.length > 0 ? (
                      card.tags.slice(0, 3).map((tag) => {
                        const isSelected = selectedTag === tag;
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTag?.(tag);
                            }}
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary"
                            )}
                          >
                            <Tag className="size-2 opacity-50" />
                            {tag}
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    )}
                    {card.tags.length > 3 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{card.tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>

                {/* 来源笔记 */}
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <BookOpen className="size-3 text-muted-foreground/60 shrink-0" />
                    <span className="truncate max-w-[160px] text-foreground/80 font-medium">
                      《{card.noteTitle}》
                    </span>
                  </div>
                </td>

                {/* 萃取日期 */}
                <td className="py-3 px-3 tabular-nums text-muted-foreground/80 text-[11px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3 text-muted-foreground/50 shrink-0" />
                    <span>{formatCardDate(card.updatedAt)}</span>
                  </div>
                </td>

                {/* 快捷操作 */}
                <td className="py-3 pr-4 pl-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="复制卡片内容"
                      onClick={(e) => handleCopy(e, card)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-md"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="删除卡片"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCard(card);
                      }}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer rounded-md"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onWriteWithCard(card);
                      }}
                      className="h-7 gap-1 px-2.5 text-[11px] font-semibold cursor-pointer rounded-md"
                    >
                      <PenLine className="size-3" />
                      去创作
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
