"use client";

import {
  Bookmark,
  Check,
  Compass,
  Copy,
  Download,
  FileCheck,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLATFORM_SKILLS, type PlatformSkillId } from "@/lib/types";
import { copyWeChatRichText } from "@/lib/wechat-format";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  { id: "wechat", name: "微信公众号", badge: "深度叙事", icon: MessageSquare, color: "text-emerald-500" },
  { id: "xiaohongshu", name: "小红书笔记", badge: "爆款清单", icon: Sparkles, color: "text-rose-500" },
  { id: "zhihu", name: "知乎回答", badge: "深度思辨", icon: Compass, color: "text-blue-500" },
  { id: "x_thread", name: "X Thread / 即刻", badge: "高密推文", icon: Share2, color: "text-zinc-700 dark:text-zinc-300" },
] as const;

interface VariantsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  canvasContent: string;
  variants: Record<string, string>;
  onVariantsChange: (variants: Record<string, string>) => void;
  onOpenSaveKb: (initialPlatform: string) => void;
}

export function VariantsDrawer({
  open,
  onOpenChange,
  projectId,
  canvasContent,
  variants,
  onVariantsChange,
  onOpenSaveKb,
}: VariantsDrawerProps) {
  const [activeTab, setActiveTab] = useState<string>("wechat");
  const [adapting, setAdapting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [wechatCopied, setWechatCopied] = useState(false);

  async function generateVariant(platformId: string) {
    if (!canvasContent.trim() || adapting) return;
    setAdapting(platformId);
    try {
      const res = await fetch("/api/adapt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          platformId,
          content: canvasContent,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const updated = { ...variants, [platformId]: data.variant.content };
      onVariantsChange(updated);
    } catch {
      // 失败提示
    } finally {
      setAdapting(null);
    }
  }

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleCopyWeChat(md: string) {
    const success = await copyWeChatRichText(md, { theme: "emerald" });
    if (success) {
      setWechatCopied(true);
      setTimeout(() => setWechatCopied(false), 2000);
    }
  }

  const currentContent = variants[activeTab] || "";
  const currentPlatform = PLATFORMS.find((p) => p.id === activeTab) || PLATFORMS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl">
        {/* 顶部标题栏 */}
        <DialogHeader className="border-b px-5 py-3.5 bg-muted/30">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Share2 className="size-4" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold">多平台一键派生</DialogTitle>
                <DialogDescription className="text-xs">
                  基于当前正文，一键派生各平台专属文风排版（一鱼多吃）
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* 平台 Tab 选择条 */}
        <div className="flex items-center gap-2 border-b bg-muted/15 px-5 py-2 overflow-x-auto no-scrollbar">
          {PLATFORMS.map((p) => {
            const hasVariant = !!variants[p.id];
            const Icon = p.icon;
            const active = activeTab === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActiveTab(p.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                  active
                    ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("size-3.5", p.color)} />
                <span>{p.name}</span>
                {hasVariant && (
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 bg-background/50">
          {!currentContent ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                <currentPlatform.icon className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  尚未生成「{currentPlatform.name}」版本
                </h3>
                <p className="max-w-xs text-xs text-muted-foreground">
                  点击下方按钮，AI 将根据该平台的专属文风与排版规则快速转译
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5 rounded-md mt-2 text-xs font-semibold"
                disabled={adapting === activeTab || !canvasContent.trim()}
                onClick={() => generateVariant(activeTab)}
              >
                {adapting === activeTab ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    正在转译中…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    一键派生 {currentPlatform.name} 版
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {currentPlatform.name} · {currentContent.length} 字
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-md text-xs h-7"
                    disabled={adapting === activeTab}
                    onClick={() => generateVariant(activeTab)}
                  >
                    <RefreshCw className={cn("size-3", adapting === activeTab && "animate-spin")} />
                    重新生成
                  </Button>
                  {activeTab === "wechat" && (
                    <>
                      <Button
                        size="sm"
                        className="gap-1.5 rounded-md text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer"
                        onClick={() => handleCopyWeChat(currentContent)}
                      >
                        {wechatCopied ? (
                          <>
                            <Check className="size-3" />
                            已复制微信富文本
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            复制公众号带样式格式
                          </>
                        )}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-md text-xs h-7"
                    onClick={() => copyText(activeTab, currentContent)}
                  >
                    {copied === activeTab ? (
                      <>
                        <Check className="size-3 text-primary" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        复制 Markdown
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 rounded-md text-xs h-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onOpenSaveKb(activeTab)}
                  >
                    <Download className="size-3" />
                    存入知识库
                  </Button>
                </div>
              </div>

              {/* 渲染预览 */}
              <div
                className="prose prose-sm dark:prose-invert max-w-none leading-relaxed font-sans"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(currentContent) }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
