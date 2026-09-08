"use client";

import {
  Bookmark,
  Check,
  X,
  Copy,
  Download,
  FileCheck,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  MessageSquare,
  PenLine,
  RefreshCw,
  Share2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import { useState } from "react";
import type { ReviewReport } from "@/app/api/pipeline/review/route";
import { InkCraftMark } from "@/components/logo";
import { platformTint } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PipelineProject } from "@/lib/types";
import { useWorkshopToast } from "./toast";
import { MockNotice } from "./mock-notice";

const PLATFORMS = [
  { id: "wechat", name: "微信公众号", icon: MessageSquare },
  { id: "xiaohongshu", name: "小红书", icon: Bookmark },
  { id: "zhihu", name: "知乎", icon: HelpCircle },
  { id: "x_thread", name: "X Thread", icon: Share2 },
] as const;

const PASS_SCORE = 70;

interface ReviewStageProps {
  project: PipelineProject;
  canvasContent: string;
  variants: Record<string, string>;
  onVariantsChange: (variants: Record<string, string>) => void;
  onOpenSaveKb: (initialPlatform: string) => void;
  onBackToDraft: () => void;
  onProjectUpdate: (project: PipelineProject) => void;
}

/** 工步③ 编审·分发：出版级自检报告 + 一鱼多吃平台转译 + 完成装配终态 */
export function ReviewStage({
  project,
  canvasContent,
  variants,
  onVariantsChange,
  onOpenSaveKb,
  onBackToDraft,
  onProjectUpdate,
}: ReviewStageProps) {
  const toast = useWorkshopToast();

  const [report, setReport] = useState<ReviewReport | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [reviewMock, setReviewMock] = useState(false);

  const [activeTab, setActiveTab] = useState<string>("master");
  const [adaptingPlatform, setAdaptingPlatform] = useState<string | null>(null);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [wechatCopied, setWechatCopied] = useState(false);

  const completed = project.currentStage === "completed";
  const checklistOk = report ? report.checklist.every((i) => i.pass) : false;
  const passed = checklistOk && (report?.score ?? 0) >= PASS_SCORE;

  async function runReview() {
    if (!canvasContent.trim()) return;
    setLoadingReview(true);
    try {
      const res = await fetch("/api/pipeline/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, content: canvasContent }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReport(data.report);
      setReviewMock(data.isMock === true);
    } catch {
      toast("编审审查失败，请稍后重试", "error");
    } finally {
      setLoadingReview(false);
    }
  }

  async function runAdaptation(platformId: string) {
    if (!canvasContent.trim() || adaptingPlatform) return;
    setAdaptingPlatform(platformId);
    setActiveTab(platformId);
    try {
      const res = await fetch("/api/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          platformId,
          content: canvasContent,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onVariantsChange({ ...variants, [platformId]: data.content });
    } catch {
      toast(
        `转译为${PLATFORMS.find((p) => p.id === platformId)?.name || "平台"}失败`,
        "error",
      );
    } finally {
      setAdaptingPlatform(null);
    }
  }

  async function completeAssembly() {
    if (completing) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStage: "completed" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast("母稿已锁定", "success");
      onProjectUpdate(data.project);
      onOpenSaveKb("master");
    } catch {
      toast("完成装配失败，请稍后重试", "error");
    } finally {
      setCompleting(false);
    }
  }

  async function copyWeChatRichText() {
    const rawText = variants.wechat || canvasContent;
    const htmlWithStyles = formatToWeChatHtml(rawText);
    try {
      const blobHtml = new Blob([htmlWithStyles], { type: "text/html" });
      const blobPlain = new Blob([rawText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blobHtml, "text/plain": blobPlain }),
      ]);
    } catch {
      await navigator.clipboard.writeText(rawText);
      toast("浏览器不支持富文本剪贴板，已复制纯文本", "info");
    }
    setWechatCopied(true);
    setTimeout(() => setWechatCopied(false), 2000);
  }

  function copyTabText(tab: string) {
    const text = tab === "master" ? canvasContent : variants[tab] || "";
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
  }

  const currentVariant =
    activeTab === "master" ? "" : variants[activeTab] || "";

  return (
    <div className="flex h-full">
      {/* 左：编审报告 */}
      <aside className="w-[26rem] shrink-0 space-y-4 overflow-y-auto border-r bg-muted/20 p-5">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <FileCheck className="size-4 text-primary" />
            核稿清单
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            机械校验先行，四项核稿，全过才可锁定。
          </p>
        </div>

        {reviewMock && <MockNotice label="编审报告为演示数据" />}

        {completed && (
          <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="size-4" />
              已完成装配
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              母稿与平台派生版已收入成品库，可随时回看、复制或沉淀入库。
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                asChild
                className="h-7 gap-1 text-xs"
              >
                <Link href="/works">
                  前往成品库
                  <Share2 className="size-3" />
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onBackToDraft}
                className="h-7 gap-1 text-xs text-muted-foreground"
              >
                回到起草
              </Button>
            </div>
          </div>
        )}

        {!report && !loadingReview && (
          <div className="space-y-3 rounded-xl border border-dashed py-10 text-center">
            <Sparkles className="mx-auto size-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              尚未运行编审，点击下方按钮执行自检清单。
            </p>
          </div>
        )}

        <Button
          onClick={runReview}
          disabled={loadingReview || !canvasContent.trim()}
          className="w-full gap-1.5 text-xs font-medium shadow-xs"
        >
          {loadingReview ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              核稿进行中...
            </>
          ) : (
            <>
              <FileCheck className="size-3.5" />
              {report ? "重新核稿" : "运行核稿"}
            </>
          )}
        </Button>

        {report && (
          <div className="space-y-3 pt-1 text-xs">
            {/* 评分卡 */}
            <div className="flex items-center justify-between rounded-xl border bg-card p-3.5">
              <div>
                <div className="text-[10px] text-muted-foreground">
                  编审达标分（≥{PASS_SCORE} 通过）
                </div>
                <div
                  className={cn(
                    "text-2xl font-bold",
                    passed
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {report.score}
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}
                    / 100
                  </span>
                </div>
              </div>
              <Badge
                variant="secondary"
                className="max-w-36 text-wrap text-right"
              >
                {report.verdict}
              </Badge>
            </div>

            {report.overallSummary && (
              <div className="rounded-xl border bg-card p-3 leading-relaxed text-foreground/90">
                {report.overallSummary}
              </div>
            )}

            {/* CTA 按结论区分 */}
            <div className="space-y-2">
              {passed ? (
                <Button
                  onClick={completeAssembly}
                  disabled={completing || completed}
                  className="h-8 w-full gap-1.5 bg-foreground text-xs font-semibold text-background hover:bg-foreground/90"
                >
                  {completing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  {completed ? "母稿已锁定" : "全部通过 · 锁定母稿"}
                </Button>
              ) : (
                <Button
                  onClick={onBackToDraft}
                  className="h-8 w-full gap-1.5 text-xs font-semibold"
                  variant="outline"
                >
                  <PenLine className="size-3.5" />
                  核稿未通过 · 回到起草修改
                </Button>
              )}
              <Button
                onClick={() => onOpenSaveKb("master")}
                disabled={!canvasContent.trim()}
                variant="ghost"
                className="h-7 w-full gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                强制沉淀入库（不等待达标）
              </Button>
            </div>

            {/* 四项核稿清单 */}
            <div className="space-y-1.5">
              <div className="font-semibold text-muted-foreground">核稿清单</div>
              {report.checklist.map((item) => (
                <div
                  key={item.key}
                  className={cn(
                    "space-y-0.5 rounded-lg border p-2.5 text-[11px]",
                    item.pass ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-destructive/40 bg-destructive/[0.04]",
                  )}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    {item.pass ? (
                      <Check className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="size-3 shrink-0 text-destructive" />
                    )}
                    {item.label}
                  </div>
                  {item.note && <div className="text-muted-foreground">{item.note}</div>}
                </div>
              ))}
            </div>

            {/* 机械校验：未溯源数字 */}
            {report.untraceable.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-semibold text-muted-foreground">
                  机械校验 · 未能指回素材的数字
                </div>
                {report.untraceable.map((u, i) => (
                  <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-2.5 text-[11px] leading-relaxed text-foreground/90">
                    {u}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* 右：分发转译 */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Tab 栏 */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b bg-card/30 px-5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("master")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeTab === "master"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:bg-muted/30",
              )}
            >
              <FileText className="size-3.5" />
              成稿预览
            </button>
            {PLATFORMS.map((p) => {
              const isActive = activeTab === p.id;
              const hasVariant = !!variants[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveTab(p.id);
                    if (!hasVariant && canvasContent.trim())
                      runAdaptation(p.id);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted-foreground hover:bg-muted/30",
                  )}
                >
                  <p.icon className="size-3.5" />
                  {p.name}
                  {hasVariant && (
                    <span
                      className={cn(
                        "tint-dot size-1.5 rounded-full",
                        platformTint(p.id),
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "wechat" && !!variants.wechat && (
              <Button
                size="sm"
                variant="outline"
                onClick={copyWeChatRichText}
                className="h-7 gap-1 text-xs"
              >
                {wechatCopied ? (
                  <Check className="size-3 text-emerald-600" />
                ) : (
                  <Copy className="size-3" />
                )}
                {wechatCopied ? "富文本已复制" : "一键复制微信排版"}
              </Button>
            )}
            {activeTab !== "master" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => runAdaptation(activeTab)}
                disabled={adaptingPlatform !== null || !canvasContent.trim()}
                className="h-7 gap-1 text-xs text-muted-foreground"
              >
                <RefreshCw
                  className={cn(
                    "size-3",
                    adaptingPlatform === activeTab && "animate-spin",
                  )}
                />
                重新转译
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyTabText(activeTab)}
              disabled={
                activeTab === "master" ? !canvasContent.trim() : !currentVariant
              }
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {copiedTab === activeTab ? (
                <Check className="size-3 text-emerald-600" />
              ) : (
                <Copy className="size-3" />
              )}
              复制
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {activeTab === "master"
                ? canvasContent
                  ? `${canvasContent.length} 字`
                  : "空白"
                : currentVariant
                  ? `${currentVariant.length} 字`
                  : "待转译"}
            </span>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "master" ? (
            <div className="mx-auto max-w-3xl space-y-4">
              {canvasContent.trim() ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      母稿只读预览 · 修改请回到起草工位
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onBackToDraft}
                      className="h-7 gap-1 text-xs"
                    >
                      <PenLine className="size-3" />
                      回到起草修改
                    </Button>
                  </div>
                  <div
                    className="markdown-body rounded-xl border bg-card px-8 py-8 shadow-sm"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(canvasContent),
                    }}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
                  <FileText className="size-8 text-muted-foreground/30" />
                  <p className="text-sm">
                    母稿还是空白，先回到起草工位完成初稿。
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onBackToDraft}
                    className="gap-1 text-xs"
                  >
                    <PenLine className="size-3.5" />
                    回到起草
                  </Button>
                </div>
              )}
            </div>
          ) : adaptingPlatform === activeTab ? (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs">
                一鱼多吃 · 正在转译为平台专属排版...
              </span>
            </div>
          ) : currentVariant ? (
            <div className="mx-auto max-w-3xl space-y-4">
              {activeTab === "xiaohongshu" && (
                <div className="rounded-xl border bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-purple-500/10 p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                      Xiaohongshu Cover Card · 首图金句卡
                    </div>
                    <a
                      href={`/api/card?quote=${encodeURIComponent(extractQuote(currentVariant))}`}
                      download="金句卡.svg"
                      className="inline-flex items-center gap-1 rounded-md border bg-background/80 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-background"
                    >
                      <Download className="size-3" />
                      下载金句卡
                    </a>
                  </div>
                  <div className="mt-3 text-lg font-bold leading-relaxed text-foreground">
                    &ldquo;{extractQuote(currentVariant)}&rdquo;
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <InkCraftMark className="size-3.5" />
                      墨匠内容工坊 · 成果派生
                    </span>
                    <span>#深度创作</span>
                  </div>
                </div>
              )}

              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                  {currentVariant}
                </pre>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="size-3.5" />
                  派生版本已自动计入成品库
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenSaveKb(activeTab)}
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  此版本沉淀入库
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-muted-foreground">
              <Sparkles className="size-8 text-muted-foreground/30" />
              <p className="text-sm">尚未生成当前平台的转译版本</p>
              <Button
                size="sm"
                onClick={() => runAdaptation(activeTab)}
                disabled={!canvasContent.trim()}
                className="gap-1.5 text-xs"
              >
                <Sparkles className="size-3.5" />
                一键转译为当前平台
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function extractQuote(text: string): string {
  const match = text.match(/【首图金句卡】[：:\s]*["“]?([^"”\n]+)["”]?/);
  if (match) return match[1].trim();
  const firstLine = text.split("\n").find((l) => l.trim().length > 10);
  return (
    firstLine?.replace(/^#*\s*/, "").slice(0, 50) ||
    "知识管理的目标不是记住，而是把原料锻造成作品。"
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatToWeChatHtml(md: string): string {
  const body = md
    .split("\n\n")
    .map((p) => {
      const trimmed = p.trim();
      if (trimmed.startsWith("▎") || trimmed.startsWith("## ")) {
        return `<section style="font-weight: bold; font-size: 17px; margin-top: 24px; margin-bottom: 12px; color: #1a1a1a; border-left: 4px solid #07c160; padding-left: 8px;">${escapeHtml(trimmed.replace(/^[▎#\s]+/, ""))}</section>`;
      }
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        return `<p style="font-weight: 600; font-size: 15px; line-height: 1.8; color: #1a1a1a; margin-bottom: 16px; background-color: #f7f7f7; padding: 10px 14px; border-radius: 6px;">${escapeHtml(trimmed.slice(2, -2))}</p>`;
      }
      return `<p style="font-size: 15px; line-height: 1.85; color: #333333; margin-bottom: 16px; text-align: justify;">${escapeHtml(trimmed).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 677px; margin: 0 auto; padding: 16px 12px;">${body}</div>`;
}
