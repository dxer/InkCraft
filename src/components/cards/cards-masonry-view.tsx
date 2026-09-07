"use client";

import {
  ArrowUpRight,
  BookOpen,
  Copy,
  GitFork,
  PenLine,
  Tag,
  Trash2,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCardDate, type ParsedCardItem } from "./card-utils";

interface CardsMasonryViewProps {
  cards: ParsedCardItem[];
  onSelectCard: (card: ParsedCardItem) => void;
  onWriteWithCard: (card: ParsedCardItem) => void;
  onDeleteCard: (card: ParsedCardItem) => void;
  onSelectTag?: (tag: string) => void;
  selectedTag?: string | null;
}

export function CardsMasonryView({
  cards,
  onSelectCard,
  onWriteWithCard,
  onDeleteCard,
  onSelectTag,
  selectedTag,
}: CardsMasonryViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, card: ParsedCardItem) => {
    e.stopPropagation();
    navigator.clipboard.writeText(card.raw.content_md);
    setCopiedId(card.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 根据屏幕将卡片分配到多列以实现完美的瀑布流布局
  const columns = useMemo(() => {
    // 渲染在客户端时可以按照 3 列（lg/xl）与 2 列（md）与 1 列（sm）自适应
    // 使用纯 CSS columns 或者是列数组分配
    return cards;
  }, [cards]);

  return (
    <div className="columns-1 gap-4 md:columns-2 lg:columns-3 [column-fill:_balance] space-y-4">
      {columns.map((card) => {
        return (
          <div
            key={card.id}
            onClick={() => onSelectCard(card)}
            className="group relative break-inside-avoid rounded-2xl border border-border/80 bg-card p-5 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* 顶部元信息栏 */}
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span
                  title={`来源笔记：《${card.noteTitle}》`}
                  className="inline-flex items-center gap-1 truncate max-w-[170px] font-medium text-foreground/80 hover:text-primary transition-colors"
                >
                  <BookOpen className="size-3 text-muted-foreground/70 shrink-0" />
                  《{card.noteTitle}》
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground/70 tabular-nums">
                  {formatCardDate(card.updatedAt)}
                </span>
              </div>

              {/* 断言式标题 */}
              <h3 className="text-base font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
                {card.title}
              </h3>

              {/* 自媒体传播 Hook / 痛点气泡 */}
              {card.hook && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs leading-relaxed text-amber-950 dark:text-amber-200">
                  <div className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 text-[11px] mb-1">
                    <Zap className="size-3" />
                    传播 Hook
                  </div>
                  <p className="line-clamp-2 text-xs font-medium text-foreground/90">
                    {card.hook}
                  </p>
                </div>
              )}

              {/* 核心机制 / 摘要 */}
              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground/90">
                {card.summary}
              </p>

              {/* 关联提示 Connection hints */}
              {card.connectionHints && card.connectionHints.length > 0 && (
                <div className="flex items-start gap-1 text-[11px] text-muted-foreground/80">
                  <GitFork className="size-3 mt-0.5 shrink-0 text-primary/60" />
                  <span className="line-clamp-1">
                    <span className="text-foreground/70 font-medium">联想: </span>
                    {card.connectionHints.join(" / ")}
                  </span>
                </div>
              )}

              {/* 标签 Concept Tags */}
              {card.tags && card.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {card.tags.map((tag) => {
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
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary"
                        )}
                      >
                        <Tag className="size-2.5 opacity-60" />
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 底部快捷操作栏 */}
            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
              <span className="inline-flex items-center gap-1 font-medium text-primary text-[11px]">
                查看卡片
                <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>

              <div className="flex items-center gap-1.5">
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
