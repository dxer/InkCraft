"use client";

import { Check, Copy, Download, Image as ImageIcon, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  copyQuoteCardImageToClipboard,
  downloadQuoteCardImage,
  QUOTE_CARD_THEMES,
  renderQuoteCard,
} from "@/lib/quote-card";
import { cn } from "@/lib/utils";

interface QuoteCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuote?: string;
  sourceTitle?: string;
  topicTitle?: string;
}

export function QuoteCardDialog({
  open,
  onOpenChange,
  initialQuote = "",
  sourceTitle = "",
  topicTitle = "",
}: QuoteCardDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [quote, setQuote] = useState(initialQuote);
  const [theme, setTheme] = useState<"ink" | "sunset" | "ocean">("ink");
  const [source, setSource] = useState(sourceTitle);
  const [badge, setBadge] = useState("金句萃取");
  const [copied, setCopied] = useState(false);

  // 当外部传入的 initialQuote / source 变化时同步更新
  useEffect(() => {
    if (initialQuote) setQuote(initialQuote);
    if (sourceTitle) setSource(sourceTitle);
  }, [initialQuote, sourceTitle]);

  // 当选项或内容改变时重新渲染 Canvas
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    renderQuoteCard(canvasRef.current, {
      quote: quote || "文字是思考的容器，把原料锻造成作品。",
      sourceTitle: source,
      authorOrTopic: topicTitle,
      theme,
      badgeText: badge,
    });
  }, [open, quote, theme, source, topicTitle, badge]);

  // 复制图片到剪贴板
  async function handleCopyImage() {
    if (!canvasRef.current) return;
    const success = await copyQuoteCardImageToClipboard(canvasRef.current);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // 下载图片
  function handleDownload() {
    if (!canvasRef.current) return;
    downloadQuoteCardImage(canvasRef.current, `inkcraft-quote-${Date.now()}.png`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="border-b px-5 py-3.5 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
              <Sparkles className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold">生成小红书/社交金句图卡</DialogTitle>
              <DialogDescription className="text-xs">
                3:4 比例高质感卡片图，支持一键复制到剪贴板或下载发至小红书、朋友圈、即刻
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 p-5 overflow-y-auto">
          {/* 左侧配置栏 */}
          <div className="md:col-span-6 flex flex-col gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">核心金句 / 洞察文字</label>
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="输入或粘贴需要生成卡片的金句、核心洞察或破题要点..."
                rows={5}
                className="w-full text-sm rounded-xl border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-medium leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">出处/文章标题</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="如：墨匠创作手记"
                  className="w-full text-xs rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">卡片徽章文字</label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="如：核心洞察 / 破题金句"
                  className="w-full text-xs rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">卡片主题风格</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(QUOTE_CARD_THEMES).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id as any)}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer",
                      theme === t.id
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span
                      className="size-3.5 rounded-full shrink-0 border"
                      style={{ backgroundColor: t.bgStart }}
                    />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <Button
                variant="default"
                className="flex-1 gap-1.5 rounded-xl cursor-pointer"
                onClick={handleCopyImage}
              >
                {copied ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4" />}
                {copied ? "图片已复制到剪贴板！" : "一键复制图片"}
              </Button>
              <Button
                variant="outline"
                className="gap-1.5 rounded-xl cursor-pointer"
                onClick={handleDownload}
              >
                <Download className="size-4" />
                下载 PNG
              </Button>
            </div>
          </div>

          {/* 右侧实时预览栏 */}
          <div className="md:col-span-6 flex items-center justify-center p-2 rounded-2xl bg-muted/30 border border-dashed">
            <div className="w-full max-w-[280px] sm:max-w-[320px] aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border bg-black flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
