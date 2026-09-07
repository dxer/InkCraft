"use client";

import {
  GitFork,
  IdCard,
  Kanban,
  List,
  Search,
  Tag,
  X,
} from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CardViewMode = "masonry" | "compact" | "graph";

interface CardsViewSwitcherProps {
  viewMode: CardViewMode;
  onViewModeChange: (mode: CardViewMode) => void;
  search: string;
  onSearchChange: (search: string) => void;
  allTags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  totalCards: number;
  filteredCount: number;
}

export function CardsViewSwitcher({
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  allTags,
  selectedTag,
  onSelectTag,
  totalCards,
  filteredCount,
}: CardsViewSwitcherProps) {
  return (
    <div className="space-y-4">
      {/* 顶部控制栏：搜索 + 视图切换按钮组 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* 搜索框 */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="搜索卡片"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索断言标题、传播Hook、概念标签或来源笔记..."
            className="h-9 pl-9 pr-8 text-xs rounded-xl bg-card border-border/80"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* 视图切换按钮组 */}
        <div className="flex items-center gap-1 self-start rounded-xl border border-border/80 bg-muted/30 p-1 shadow-2xs sm:self-auto">
          <button
            type="button"
            onClick={() => onViewModeChange("masonry")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
              viewMode === "masonry"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Kanban className="size-3.5 text-primary" />
            <span>瀑布看板</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange("compact")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
              viewMode === "compact"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <List className="size-3.5 text-primary" />
            <span>紧凑清单</span>
          </button>

          {/* 知识图谱按钮：在小屏/手机端标记为桌面端体验或隐藏 */}
          <button
            type="button"
            onClick={() => onViewModeChange("graph")}
            className={cn(
              "hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
              viewMode === "graph"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <GitFork className="size-3.5 text-primary" />
            <span>知识图谱</span>
          </button>
        </div>
      </div>

      {/* 标签过滤条（如有标签） */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-medium text-muted-foreground mr-1 flex items-center gap-1">
            <Tag className="size-3" />
            概念标签:
          </span>

          <button
            type="button"
            onClick={() => onSelectTag(null)}
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
              selectedTag === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            全部 ({totalCards})
          </button>

          {allTags.slice(0, 15).map((tag) => {
            const isSelected = selectedTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectTag(isSelected ? null : tag)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-secondary/70 text-secondary-foreground hover:bg-primary/10 hover:text-primary"
                )}
              >
                <span>#{tag}</span>
              </button>
            );
          })}

          {selectedTag && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectTag(null)}
              className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-2.5" />
              清除筛选
            </Button>
          )}

          {filteredCount !== totalCards && (
            <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
              匹配到 {filteredCount} / {totalCards} 张卡片
            </span>
          )}
        </div>
      )}
    </div>
  );
}
