"use client";

import { Loader2, RefreshCw, Sparkles, Sprout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SproutResult } from "@/lib/sprout";

interface SproutPanelProps {
  sprout: SproutResult | null;
  sproutLoading: boolean;
  reSprouting: boolean;
  onReSprout: () => void;
  onSendToWorkshop: (sprout: SproutResult) => void;
}

/**
 * 智鉴 · 知识发芽档案面板（笔记 Tab 的 sprout 视图）。
 * 纯展示组件：发芽数据与触发回调由父组件注入。
 */
export function SproutPanel({
  sprout,
  sproutLoading,
  reSprouting,
  onReSprout,
  onSendToWorkshop,
}: SproutPanelProps) {
  return (
    <div className="space-y-4 py-2">
      {/* 得到大脑级：智鉴 (知识发芽 Sprout) 档案 */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-card via-muted/10 to-muted/25 p-6 space-y-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sprout className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
                <span>智鉴 · 灵感关联与发散大纲</span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal px-1.5 py-0 h-4 text-emerald-600 border-emerald-500/30"
                >
                  灵感生根
                </Badge>
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                以本篇笔记为核心，跨库关联知识素材，叙事型思考教练理清脉络并推演成文大纲
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={onReSprout}
            disabled={reSprouting || sproutLoading}
            className="h-7 px-2.5 text-xs gap-1.5 rounded-md shadow-2xs"
          >
            <RefreshCw
              className={`size-3 ${reSprouting ? "animate-spin" : ""}`}
            />
            <span>{reSprouting ? "正在发散关联..." : "重新激发灵感"}</span>
          </Button>
        </div>

        {sproutLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-emerald-600" />
            <span>正在跨库检索知识养料，思考教练讲故事的功力全开...</span>
          </div>
        ) : sprout ? (
          <div className="space-y-5 text-xs">
            {/* 开场解读 */}
            <p className="border-l-2 border-emerald-500/40 pl-4 text-[13px] leading-relaxed text-foreground/90">
              {sprout.opening}
            </p>

            {/* 发芽画卷 */}
            {sprout.sprouts.map((s, idx) => {
              const relatedNotes = (sprout.material_mappings || []).filter(
                (m) => (s.related_doc_ids || []).includes(m.documentId),
              );
              return (
                <div
                  key={idx}
                  className="space-y-3 rounded-xl border border-border/60 bg-background/90 p-5 shadow-2xs"
                >
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-lg font-bold tabular-nums text-foreground/20">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <h4 className="text-sm font-semibold tracking-tight text-foreground">
                      {s.title}
                    </h4>
                  </div>

                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Sprout className="size-3" />
                      种子
                    </span>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">
                      {s.seed}
                    </p>
                    {relatedNotes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {relatedNotes.map((m) => (
                          <Badge
                            key={m.documentId}
                            variant="outline"
                            className="max-w-52 truncate text-[10px] font-normal text-muted-foreground"
                          >
                            《{m.documentTitle}》
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {s.aha_moment && (
                    <div className="border-l-2 border-amber-400/60 bg-amber-500/[0.06] px-3.5 py-2.5 text-[13px] italic leading-relaxed text-foreground">
                      <span className="mr-1.5 inline-flex items-center gap-1 font-semibold not-italic text-amber-600 dark:text-amber-400">
                        <Sparkles className="size-3" />
                        Aha 瞬间
                      </span>
                      {s.aha_moment}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 金句回响 */}
            {sprout.quote_echo &&
              (sprout.quote_echo.original ||
                (sprout.quote_echo.perspectives || []).length > 0) && (
                <div className="space-y-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.05] to-transparent p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    金句回响 · Echoes
                  </div>
                  {sprout.quote_echo.original && (
                    <p className="text-[13px] font-medium leading-relaxed text-foreground">
                      “{sprout.quote_echo.original}”
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                        —— 笔记原话
                      </span>
                    </p>
                  )}
                  {(sprout.quote_echo.perspectives || []).map((p, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="text-[11px] font-semibold text-primary/80">
                        {p.label}
                      </div>
                      <p className="text-[12px] leading-relaxed text-foreground/80">
                        “{p.quote}”
                        <span className="text-muted-foreground">
                          {" "}
                          —— {p.author}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

            {/* 底部动作 */}
            <div className="flex items-center justify-between border-t border-border/40 pt-3.5">
              <button
                type="button"
                onClick={() => {
                  const report = [
                    "【智鉴发芽报告】",
                    "",
                    sprout.opening,
                    "",
                    ...sprout.sprouts.flatMap((s, i) => [
                      `${String(i + 1).padStart(2, "0")}. ${s.title}`,
                      `🌱 种子：${s.seed}`,
                      s.aha_moment ? `✨ Aha 瞬间：${s.aha_moment}` : "",
                      "",
                    ]),
                    sprout.quote_echo?.original
                      ? `金句回响：${sprout.quote_echo.original}`
                      : "",
                    ...(sprout.quote_echo?.perspectives || []).map(
                      (p) => `· ${p.label}：「${p.quote}」—— ${p.author}`,
                    ),
                  ]
                    .filter(Boolean)
                    .join("\n");
                  navigator.clipboard.writeText(report);
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                复制完整发芽报告
              </button>

              <Button
                size="sm"
                onClick={() => onSendToWorkshop(sprout)}
                className="h-7 gap-1.5 rounded-md bg-foreground px-3 text-xs font-semibold text-background shadow-xs hover:bg-foreground/90"
              >
                <Sparkles className="size-3.5" />以本大纲起草长文 (自动带入关联素材)
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-10 text-center text-xs text-muted-foreground">
            <p>当前笔记尚未生成「灵感关联大纲」</p>
            <Button
              size="sm"
              onClick={onReSprout}
              disabled={reSprouting}
              className="gap-1.5 bg-foreground text-xs font-semibold text-background hover:bg-foreground/90"
            >
              <Sprout className="size-3.5" />
              立即激发灵感大纲
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
