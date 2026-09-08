"use client";

import {
  ArrowLeft,
  Bookmark,
  Check,
  Compass,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderPlus,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageSquare,
  Share2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { StageBadge, platformTint } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { QuoteCardDialog } from "@/components/workshop/quote-card-dialog";
import { SaveToKbDialog } from "@/components/workshop/save-to-kb-dialog";
import { copyWeChatRichText } from "@/lib/wechat-format";
import { cn } from "@/lib/utils";

interface WorkDetail {
  id: string;
  title: string;
  currentStage: string;
  targetSkill?: string | null;
  topicId?: string | null;
  selectedTopic?: {
    title: string;
    angle?: string;
    hook?: string;
    outline?: string[];
  } | null;
  masterContent: string;
  updatedAt: string;
  variants: Record<string, { name: string; content: string }>;
}

const PLATFORMS = [
  { id: "master", name: "成稿母稿", icon: FileText },
  { id: "wechat", name: "微信公众号", icon: MessageSquare },
  { id: "xiaohongshu", name: "小红书", icon: Bookmark },
  { id: "zhihu", name: "知乎", icon: HelpCircle },
  { id: "x_thread", name: "X Thread", icon: Share2 },
] as const;

export default function WorkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workId = params.id as string;

  const [work, setWork] = useState<WorkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("master");
  const [copied, setCopied] = useState(false);
  const [wechatCopied, setWechatCopied] = useState(false);
  const [saveToKbOpen, setSaveToKbOpen] = useState(false);
  const [quoteCardOpen, setQuoteCardOpen] = useState(false);

  useEffect(() => {
    if (!workId) return;
    fetch(`/api/works/${workId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.work) {
          setWork(data.work);
        }
      })
      .finally(() => setLoading(false));
  }, [workId]);

  // 当前选中平台的正文文本
  const currentText = useMemo(() => {
    if (!work) return "";
    if (activeTab === "master") return work.masterContent || "";
    return work.variants[activeTab]?.content || "";
  }, [work, activeTab]);

  // Markdown 渲染 HTML
  const renderedHtml = useMemo(() => {
    if (!currentText.trim()) return "";
    try {
      return renderMarkdown(currentText);
    } catch {
      return currentText;
    }
  }, [currentText]);

  // 复制当前文本
  function handleCopyText() {
    if (!currentText) return;
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // 复制微信富文本
  async function handleCopyWeChat() {
    if (!currentText) return;
    const ok = await copyWeChatRichText(currentText, { theme: "emerald", title: work?.title });
    if (ok) {
      setWechatCopied(true);
      setTimeout(() => setWechatCopied(false), 2000);
    } else {
      handleCopyText();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!work) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-3 text-muted-foreground">
        <p className="text-sm">未找到该作品或已被删除</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push("/works")}
        >
          返回成品库
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      {/* 顶部固定导航栏 */}
      <header className="sticky top-0 z-30 flex flex-col sm:flex-row sm:h-13 shrink-0 sm:items-center sm:justify-between border-b bg-background/95 px-4 sm:px-8 py-2.5 sm:py-0 backdrop-blur-md gap-2 sm:gap-4">
        <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0">
          <Link
            href="/works"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pr-2 border-r border-border/60 shrink-0"
          >
            <ArrowLeft className="size-3.5" />
            <span>返回</span>
          </Link>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-xs sm:text-sm tracking-tight text-foreground truncate max-w-[180px] sm:max-w-md">
              {work.title}
            </span>
            <StageBadge stage={work.currentStage} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
          <Button
            size="sm"
            variant="outline"
            asChild
            className="h-7 sm:h-8 gap-1 sm:gap-1.5 text-xs font-semibold rounded-md shadow-xs cursor-pointer px-2 sm:px-3"
          >
            <Link href={`/workshop?projectId=${encodeURIComponent(workId)}`}>
              <ExternalLink className="size-3.5 hidden sm:inline" />
              继续装配
            </Link>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setQuoteCardOpen(true)}
            disabled={!currentText.trim()}
            className="h-7 sm:h-8 gap-1 sm:gap-1.5 text-xs font-semibold rounded-md shadow-xs text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/10 cursor-pointer px-2 sm:px-3"
          >
            <Sparkles className="size-3.5" />
            金句卡
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setSaveToKbOpen(true)}
            className="h-7 sm:h-8 gap-1 sm:gap-1.5 text-xs font-semibold rounded-md shadow-xs cursor-pointer px-2 sm:px-3"
          >
            <FolderPlus className="size-3.5 text-primary" />
            存知识库
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyWeChat}
            disabled={!currentText.trim()}
            className="h-7 sm:h-8 gap-1 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 cursor-pointer px-2 sm:px-3"
          >
            {wechatCopied ? (
              <Check className="size-3 text-emerald-600" />
            ) : (
              <MessageSquare className="size-3" />
            )}
            {wechatCopied ? "微信已复制" : "公众号"}
          </Button>

          <Button
            size="sm"
            onClick={handleCopyText}
            className="h-7 sm:h-8 gap-1 sm:gap-1.5 text-xs font-semibold rounded-md shadow-xs bg-foreground text-background hover:bg-foreground/90 cursor-pointer px-2.5 sm:px-3"
          >
            {copied ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3" />
            )}
            {copied ? "已复制" : "复制正文"}
          </Button>
        </div>
      </header>

      {/* 主体内容区 */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6">
        {/* 平台版本选择 Tab 栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-3 gap-2 sm:gap-0">
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {PLATFORMS.map((p) => {
              const isActive = activeTab === p.id;
              const hasContent =
                p.id === "master"
                  ? !!work.masterContent
                  : !!work.variants[p.id]?.content;

              if (!hasContent && p.id !== "master") return null;

              return (
                <button
                  key={p.id}
                  onClick={() => setActiveTab(p.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? "bg-muted text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <p.icon className="size-3.5" />
                  <span>{p.name}</span>
                  {p.id !== "master" && (
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

          <div className="text-[11px] sm:text-xs text-muted-foreground">
            <span>{currentText.length} 字</span>
            <span className="mx-1.5 sm:mx-2">·</span>
            <span>
              更新于 {new Date(work.updatedAt).toLocaleDateString("zh-CN")}
            </span>
          </div>
        </div>

        {/* 小红书首图金句卡预览 */}
        {activeTab === "xiaohongshu" && currentText && (
          <div className="rounded-xl border bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-purple-500/10 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold tracking-wider text-rose-600 uppercase">
                Xiaohongshu Cover Card · 首图金句卡
              </div>
              <a
                href={`/api/card?quote=${encodeURIComponent(extractQuote(currentText))}`}
                download="金句卡.svg"
                className="inline-flex items-center gap-1 rounded-md border bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-background"
              >
                <Download className="size-3" />
                下载金句卡
              </a>
            </div>
            <div className="mt-3 text-lg font-bold leading-relaxed text-foreground">
              “{extractQuote(currentText)}”
            </div>
          </div>
        )}

        {/* 关联选题回溯卡 */}
        {work.selectedTopic && (
          <div className="flex items-start justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="flex size-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <Lightbulb className="size-3.5" />
              </span>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">源自选题：{work.selectedTopic.title}</span>
                </div>
                {work.selectedTopic.angle && (
                  <p className="text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">核心切角：</span>
                    {work.selectedTopic.angle}
                  </p>
                )}
                {work.selectedTopic.hook && (
                  <p className="text-amber-700 dark:text-amber-300 font-medium">
                    <span className="opacity-75">前三秒钩子：</span>
                    “{work.selectedTopic.hook}”
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/topics"
              className="text-[11px] text-amber-600 dark:text-amber-400 font-medium hover:underline shrink-0 ml-3"
            >
              前往选题库 →
            </Link>
          </div>
        )}

        {/* 成稿正文 Markdown 阅读渲染区 */}
        <div className="py-2">
          {currentText.trim() ? (
            <div
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <div className="py-20 text-center text-xs text-muted-foreground italic">
              当前平台暂未生成分发版本
            </div>
          )}
        </div>
      </div>

      {/* 沉淀至知识库弹窗 */}
      <SaveToKbDialog
        open={saveToKbOpen}
        onOpenChange={setSaveToKbOpen}
        defaultTitle={work.title}
        masterContent={work.masterContent}
        variants={Object.fromEntries(
          Object.entries(work.variants).map(([k, v]) => [k, v.content]),
        )}
        initialPlatform={activeTab}
      />

      {/* 小红书/社交媒体金句图卡对话框 */}
      <QuoteCardDialog
        open={quoteCardOpen}
        onOpenChange={setQuoteCardOpen}
        initialQuote={
          currentText
            ? currentText.replace(/^[#>*_\-\s]+/gm, "").slice(0, 150)
            : work.selectedTopic?.hook || ""
        }
        sourceTitle={work.title}
        topicTitle={work.selectedTopic?.title || ""}
      />
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

function formatToWeChatHtml(md: string): string {
  const body = md
    .split("\n\n")
    .map((p) => {
      const trimmed = p.trim();
      if (trimmed.startsWith("▎") || trimmed.startsWith("## ")) {
        return `<section style="font-weight: bold; font-size: 17px; margin-top: 24px; margin-bottom: 12px; color: #1a1a1a; border-left: 4px solid #07c160; padding-left: 8px;">${trimmed.replace(/^[▎#\s]+/, "")}</section>`;
      }
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        return `<p style="font-weight: 600; font-size: 15px; line-height: 1.8; color: #1a1a1a; margin-bottom: 16px; background-color: #f7f7f7; padding: 10px 14px; border-radius: 6px;">${trimmed.slice(2, -2)}</p>`;
      }
      return `<p style="font-size: 15px; line-height: 1.85; color: #333333; margin-bottom: 16px; text-align: justify;">${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 677px; margin: 0 auto; padding: 16px 12px;">${body}</div>`;
}
