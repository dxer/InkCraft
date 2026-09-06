"use client";

import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  ExternalLink,
  FileText,
  IdCard,
  Layers,
  Lightbulb,
  Plus,
  Quote,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClaimSnapshot, PipelineProject } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MaterialItem {
  id: string;
  itemId: string;
  title: string | null;
  content: string;
}

interface MaterialsSidebarProps {
  project: PipelineProject;
  claimSnapshot: ClaimSnapshot | null;
  materials: MaterialItem[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onInsertText: (text: string) => void;
}

export function MaterialsSidebar({
  project,
  claimSnapshot,
  materials,
  isOpen,
  onToggleOpen,
  onInsertText,
}: MaterialsSidebarProps) {
  const [activeSection, setActiveSection] = useState<"all" | "topic" | "card" | "materials">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyText(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const selectedTopic = project.selectedTopic;

  if (!isOpen) {
    return (
      <div className="flex flex-col items-center border-r bg-muted/20 py-3 px-1.5 shrink-0 select-none">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onToggleOpen}
          title="展开原料与参考抽屉"
          className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <ChevronRight className="size-4" />
        </Button>
        <div
          onClick={onToggleOpen}
          className="mt-6 flex flex-col items-center gap-2 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer [writing-mode:vertical-rl]"
        >
          <Layers className="size-3.5" />
          <span>原料与参考 ({materials.length + (claimSnapshot ? 1 : 0)})</span>
        </div>
      </div>
    );
  }

  return (
    <aside className="flex w-80 flex-col border-r bg-muted/10 shrink-0 select-none overflow-hidden">
      {/* 抽屉头部 */}
      <div className="flex h-11 items-center justify-between border-b px-3.5 bg-background/50">
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">原料与参考抽屉</span>
          <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
            {materials.length + (claimSnapshot ? 1 : 0)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onToggleOpen}
          title="收起抽屉"
          className="size-6 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
      </div>

      {/* 快速分类筛选 */}
      <div className="flex items-center gap-1 border-b bg-muted/20 px-3 py-1.5 text-[11px]">
        <button
          onClick={() => setActiveSection("all")}
          className={cn(
            "rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
            activeSection === "all"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          全部
        </button>
        {selectedTopic?.angle && (
          <button
            onClick={() => setActiveSection("topic")}
            className={cn(
              "rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
              activeSection === "topic"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            选题切角
          </button>
        )}
        {claimSnapshot && (
          <button
            onClick={() => setActiveSection("card")}
            className={cn(
              "rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
              activeSection === "card"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            卡片立论
          </button>
        )}
        <button
          onClick={() => setActiveSection("materials")}
          className={cn(
            "rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
            activeSection === "materials"
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          素材 ({materials.length})
        </button>
      </div>

      {/* 滚动内容区 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 no-scrollbar">
        {/* 0. 选题切角与论证骨架 */}
        {selectedTopic?.angle && (activeSection === "all" || activeSection === "topic") && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="size-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">选题核心切角与骨架</span>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() =>
                  onInsertText(
                    `> 🎯 核心切角：${selectedTopic.angle}\n\n${
                      selectedTopic.outline && selectedTopic.outline.length > 0
                        ? selectedTopic.outline.map((l) => `## ${l}`).join("\n\n") + "\n\n"
                        : ""
                    }`
                  )
                }
                title="一键插入切角与大纲到正文"
                className="size-5 text-amber-600 hover:bg-amber-500/10 cursor-pointer"
              >
                <Plus className="size-3" />
              </Button>
            </div>

            <p className="text-xs font-medium leading-relaxed text-foreground">
              {selectedTopic.angle}
            </p>

            {selectedTopic.outline && selectedTopic.outline.length > 0 && (
              <div className="rounded-lg bg-background/60 p-2 space-y-1 text-[11px] font-mono text-muted-foreground">
                <div className="font-semibold text-foreground/80 mb-0.5">递进大纲：</div>
                {selectedTopic.outline.map((line, idx) => (
                  <div key={idx} className="truncate">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 1. 卡片主张快照 */}
        {claimSnapshot && (activeSection === "all" || activeSection === "card") && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <IdCard className="size-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">知识卡片核心立论</span>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onInsertText(`> 「${claimSnapshot.claim}」\n\n`)}
                title="引用到正文"
                className="size-5 text-primary hover:bg-primary/10"
              >
                <Plus className="size-3" />
              </Button>
            </div>
            <p className="text-xs font-medium leading-relaxed text-foreground">
              {claimSnapshot.claim}
            </p>
            {claimSnapshot.noteTitle && (
              <p className="text-[10px] text-muted-foreground">
                源自：《{claimSnapshot.noteTitle}》
              </p>
            )}
            {claimSnapshot.boundary && (
              <div className="rounded bg-background/60 p-1.5 text-[11px] text-muted-foreground leading-snug">
                <span className="font-medium text-foreground/80">边界：</span>
                {claimSnapshot.boundary}
              </div>
            )}
          </div>
        )}

        {/* 2. 挂载素材列表 */}
        {(activeSection === "all" || activeSection === "materials") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold text-muted-foreground">
                关联素材与切片
              </span>
              <span className="text-[10px] text-muted-foreground">
                共 {materials.length} 条
              </span>
            </div>

            {materials.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                暂未挂载素材，可直接使用选题立论起草
              </div>
            ) : (
              materials.map((m, idx) => (
                <div
                  key={m.id || idx}
                  className="group rounded-lg border bg-card p-2.5 space-y-1.5 transition-all hover:border-primary/40 hover:shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <FileText className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate text-xs font-medium text-foreground">
                        {m.title || `素材 [${idx + 1}]`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => copyText(m.id || String(idx), m.content)}
                        title="复制素材原文"
                        className="size-5 rounded text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onInsertText(`\n\n> 引用素材《${m.title || "参考"}》：\n> ${m.content.slice(0, 180)}\n\n`)}
                        title="一键引用到正文"
                        className="size-5 rounded text-primary hover:bg-primary/10"
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground/90 font-mono select-text">
                    {m.content}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
