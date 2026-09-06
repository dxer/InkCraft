"use client";

import { Check, FileStack, PenLine, Quote, Target } from "lucide-react";
import type { PipelineProject } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * 左栏 · 项目产物栏（始终在）：
 * 卡片快照（卡片模式）/ 题旨 / 素材 / 母稿状态，点产物可预览。
 * 未完成的产物置灰。
 */
export function ProjectRail({ project }: { project: PipelineProject }) {
  const snap = project.claimSnapshot;
  const brief = project.brief;
  const packCount = project.chunkSelection?.length || 0;
  const hasDraft = !!project.masterContent?.trim();
  const locked = project.currentStage === "completed";

  const briefRows: { label: string; value: string }[] | null = brief
    ? [
        { label: "给谁看", value: brief.audience },
        { label: "要接受", value: brief.acceptance },
        { label: "开篇", value: brief.intent },
        { label: "不写", value: brief.avoid },
      ]
    : null;

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-3 overflow-y-auto border-r bg-muted/20 p-4 xl:flex">
      {/* 卡片快照（仅卡片模式） */}
      {snap && (
        <RailSection icon={<Quote className="size-3.5" />} title="卡片快照" done>
          <div className="space-y-1.5">
            <p className="text-xs font-medium leading-relaxed text-foreground">{snap.claim}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              《{snap.noteTitle || "未命名笔记"}》
            </p>
            {snap.boundary && (
              <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                边界：{snap.boundary}
              </p>
            )}
            {snap.confidence && (
              <p className="text-[11px] text-muted-foreground">信度：{snap.confidence}</p>
            )}
          </div>
        </RailSection>
      )}

      {/* 题旨 */}
      <RailSection icon={<Target className="size-3.5" />} title="题旨" done={!!brief}>
        {briefRows ? (
          <div className="space-y-1.5">
            {briefRows.map((r) => (
              <div key={r.label}>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {r.label}
                </span>
                <p className="text-[11px] leading-relaxed text-foreground">{r.value || "随取证补充"}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">锁题后在此可见四行题旨</p>
        )}
      </RailSection>

      {/* 素材包 */}
      <RailSection icon={<FileStack className="size-3.5" />} title="素材包" done={packCount > 0}>
        <p className={cn("text-[11px]", packCount > 0 ? "text-foreground" : "text-muted-foreground")}>
          {packCount > 0 ? `已装箱 ${packCount} 条切片` : "取证后可见素材包"}
        </p>
      </RailSection>

      {/* 母稿 */}
      <RailSection icon={<PenLine className="size-3.5" />} title="母稿" done={hasDraft}>
        <p
          className={cn(
            "inline-flex items-center gap-1 text-[11px]",
            locked ? "font-medium text-emerald-600 dark:text-emerald-400" : hasDraft ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {locked && <Check className="size-3" />}
          {locked ? "已完成装配" : hasDraft ? "已有草稿" : "尚未起草"}
        </p>
      </RailSection>
    </aside>
  );
}

function RailSection({
  icon,
  title,
  done,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-3 transition-opacity",
        !done && "opacity-60"
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
        <span className={cn(done ? "text-primary" : "text-muted-foreground")}>{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}
