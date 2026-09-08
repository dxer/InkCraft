"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  GitFork,
  PenLine,
  Plus,
  Sparkles,
  Tag,
  X,
  Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCardDate, type ParsedCardItem } from "./card-utils";

export interface ConnectedNeighbor {
  card: ParsedCardItem;
  relationType: "source_derived" | "tag_concept" | "hint_link";
  relationLabel: string;
}

interface CardsGraphDrawerProps {
  card: ParsedCardItem | null;
  neighbors: ConnectedNeighbor[];
  onClose: () => void;
  onNavigateToCard: (card: ParsedCardItem) => void;
  onWriteWithCard: (card: ParsedCardItem) => void;
  isInPearlChain?: boolean;
  onTogglePearlChain?: (card: ParsedCardItem) => void;
}

export function CardsGraphDrawer({
  card,
  neighbors,
  onClose,
  onNavigateToCard,
  onWriteWithCard,
  isInPearlChain = false,
  onTogglePearlChain,
}: CardsGraphDrawerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!card) return;
    navigator.clipboard.writeText(card.raw.content_md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const htmlBody = useMemo(() => {
    if (!card?.body) return "";
    try {
      return renderMarkdown(card.body);
    } catch {
      return card.body;
    }
  }, [card?.body]);

  if (!card) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-l border-border/80 bg-background/95 text-foreground shadow-2xl backdrop-blur-xl">
      {/* 顶部抽屉栏 */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-5 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GitFork className="size-3.5" />
          </span>
          <div className="min-w-0">
            <span className="truncate text-xs font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="size-3 text-muted-foreground/70 shrink-0" />
              《{card.noteTitle}》
            </span>
            <span className="block text-[10px] text-muted-foreground tabular-nums">
              {formatCardDate(card.updatedAt)} · 永久知识卡片
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* 抽屉正文区域 */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* 标签 */}
        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
              >
                <Tag className="size-2.5 opacity-60 text-primary" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 断言式标题 */}
        <h2 className="text-base font-bold leading-snug tracking-tight text-foreground">
          {card.title}
        </h2>

        {/* 传播 Hook 专属高亮块 */}
        {card.hook && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Zap className="size-3.5" />
              自媒体传播 Hook（情绪痛点 / 爆款切入）
            </div>
            <p className="mt-1.5 text-xs font-medium leading-relaxed text-amber-900 dark:text-amber-100">
              {card.hook}
            </p>
          </div>
        )}

        {/* 正文 Markdown 渲染 */}
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <div
            className="markdown-body text-xs leading-relaxed"
            dangerouslySetInnerHTML={{ __html: htmlBody }}
          />
        </div>

        {/* 一度关联网络（1-Hop Neighbors） */}
        <div className="space-y-2.5 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <GitFork className="size-3.5 text-primary" />
              一度关联拓扑网络
            </span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {neighbors.length} 个直接连通节点
            </span>
          </div>

          {neighbors.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 p-3.5 text-center text-xs text-muted-foreground">
              暂无一度关联卡片（当前为独立知识节点）
            </div>
          ) : (
            <div className="space-y-1.5">
              {neighbors.map((item) => (
                <button
                  key={item.card.id}
                  onClick={() => onNavigateToCard(item.card)}
                  className="group flex w-full items-start justify-between gap-2 rounded-xl border border-border/70 bg-card p-2.5 text-left transition-all hover:border-primary/50 hover:bg-muted/40 cursor-pointer shadow-2xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-medium",
                          item.relationType === "source_derived"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : item.relationType === "tag_concept"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        )}
                      >
                        {item.relationLabel}
                      </span>
                      <span className="truncate text-muted-foreground max-w-[130px]">
                        《{item.card.noteTitle}》
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                      {item.card.title}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/40 px-5 py-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 gap-1.5 rounded-lg text-xs cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="size-3 text-primary" />
                已复制
              </>
            ) : (
              <>
                <Copy className="size-3" />
                复制
              </>
            )}
          </Button>

          {onTogglePearlChain && (
            <Button
              variant={isInPearlChain ? "secondary" : "outline"}
              size="sm"
              onClick={() => onTogglePearlChain(card)}
              className={cn(
                "h-8 gap-1 rounded-lg text-xs cursor-pointer",
                isInPearlChain && "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200"
              )}
            >
              {isInPearlChain ? (
                <>
                  <Check className="size-3 text-amber-600" />
                  已在珍珠链
                </>
              ) : (
                <>
                  <Plus className="size-3" />
                  串珍珠
                </>
              )}
            </Button>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => onWriteWithCard(card)}
          className="h-8 gap-1.5 rounded-lg text-xs font-semibold cursor-pointer"
        >
          <PenLine className="size-3.5" />
          去创作
        </Button>
      </div>
    </div>
  );
}
