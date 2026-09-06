"use client";

import { Check, Copy, Feather, FolderPlus, Loader2, PenLine, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { InkCraftMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PipelineProject, PipelineStage } from "@/lib/types";

export const WIZARD_STAGES: { key: PipelineStage; step: string; name: string; icon: typeof Feather }[] = [
  { key: "ideate", step: "01", name: "构思", icon: Feather },
  { key: "draft", step: "02", name: "起草", icon: PenLine },
  { key: "review", step: "03", name: "编审 · 分发", icon: ScanSearch },
];

export function stageIndexOf(stage: PipelineStage): number {
  if (stage === "completed") return WIZARD_STAGES.length - 1;
  const idx = WIZARD_STAGES.findIndex((s) => s.key === stage);
  return idx < 0 ? 0 : idx;
}

interface WizardProgressProps {
  project: PipelineProject;
  saving: boolean;
  copied: boolean;
  canArchive: boolean;
  onTitleChange: (title: string) => void;
  onStageClick: (stage: PipelineStage) => void;
  onArchive: () => void;
  onCopyMaster: () => void;
  onNewProject: () => void;
}

/** 工坊向导顶部：品牌、可编辑标题、三工步进度条与全局动作 */
export function WizardProgress({
  project,
  saving,
  copied,
  canArchive,
  onTitleChange,
  onStageClick,
  onArchive,
  onCopyMaster,
  onNewProject,
}: WizardProgressProps) {
  const [titleDraft, setTitleDraft] = useState(project.title);

  useEffect(() => {
    setTitleDraft(project.title);
  }, [project.id, project.title]);

  const currentIndex = stageIndexOf(project.currentStage);
  const completed = project.currentStage === "completed";

  return (
    <header className="shrink-0 border-b bg-background">
      {/* 主行：品牌 + 标题 + 动作 */}
      <div className="flex h-13 items-center justify-between px-6">
        <div className="flex min-w-0 items-center gap-3">
          <InkCraftMark className="size-6 shrink-0 text-foreground" />
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              const next = titleDraft.trim();
              if (next && next !== project.title) onTitleChange(next);
              else setTitleDraft(project.title);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="min-w-0 max-w-md truncate rounded-md bg-transparent px-1.5 py-0.5 text-sm font-semibold tracking-tight outline-none transition-colors hover:bg-muted/50 focus:bg-muted/50"
          />
          {saving && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              保存中...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onNewProject}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            新的创作
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCopyMaster}
            className="h-8 gap-1.5 text-xs font-medium rounded-md shadow-xs"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            {copied ? "已复制" : "复制母稿"}
          </Button>
          <Button
            size="sm"
            onClick={onArchive}
            disabled={!canArchive}
            className="h-8 gap-1.5 rounded-md bg-foreground text-xs font-semibold text-background shadow-xs hover:bg-foreground/90"
          >
            <FolderPlus className="size-3.5 text-primary" />
            沉淀入库
          </Button>
        </div>
      </div>

      {/* 次行：三工步进度条 */}
      <div className="flex items-center justify-center gap-0 px-6 pb-3">
        {WIZARD_STAGES.map((s, idx) => {
          const isCurrent = !completed && idx === currentIndex;
          const isDone = completed || idx < currentIndex;
          const unlocked = idx <= currentIndex;
          return (
            <div key={s.key} className="flex items-center">
              {idx > 0 && (
                <div
                  className={cn(
                    "h-px w-16 transition-colors sm:w-24",
                    isDone || unlocked ? "bg-primary/40" : "bg-border"
                  )}
                />
              )}
              <button
                onClick={() => unlocked && onStageClick(s.key)}
                disabled={!unlocked}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-all",
                  isCurrent && "bg-primary/10 text-primary shadow-xs",
                  isDone && !isCurrent && "text-foreground/80 hover:bg-muted/50",
                  !isCurrent && !isDone && "text-muted-foreground/50",
                  unlocked && "cursor-pointer",
                  !unlocked && "cursor-not-allowed opacity-60"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border text-[10px] tabular-nums transition-colors",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                    isDone && !isCurrent && "border-primary/40 bg-primary/10 text-primary",
                    !isCurrent && !isDone && "border-border text-muted-foreground/60"
                  )}
                >
                  {isDone && !isCurrent ? <Check className="size-3" /> : s.step}
                </span>
                <span className="hidden sm:inline">{s.name}</span>
              </button>
            </div>
          );
        })}
        {completed && (
          <div className="ml-6 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" />
            已完成装配
          </div>
        )}
      </div>
    </header>
  );
}
