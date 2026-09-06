"use client";

import {
  AlertCircle,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  copySvgAsPngToClipboard,
  downloadSvgAsPng,
} from "@/lib/svg-cover";
import { cn } from "@/lib/utils";

const MAGAZINE_STYLES = [
  { id: "wired", name: "极客连线", desc: "碳黑底色 · 荧光绿底块 · 赛博网格 · 条形码", color: "bg-emerald-950 border-emerald-500/50" },
  { id: "business", name: "商业周刊", desc: "深藏蓝底 · 琥珀明黄高光 · 粗黑大字", color: "bg-amber-950 border-amber-500/50" },
  { id: "monocle", name: "新经典出版", desc: "温润米白 · 细线框 · 典雅衬线 · 朱红方印", color: "bg-zinc-200 border-zinc-500/50 text-zinc-900" },
  { id: "swiss", name: "极简瑞士风", desc: "纯黑底色 · 巨幅红白对比 · 瑞士大字报", color: "bg-rose-950 border-rose-500/50" },
] as const;

interface AiCoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  angle?: string;
  hook?: string;
  summary?: string;
  category?: string;
}

export function AiCoverDialog({
  open,
  onOpenChange,
  title: initialTitle = "",
  category = "深度特稿",
}: AiCoverDialogProps) {
  const [title, setTitle] = useState(initialTitle || "深度思考与知识沉淀");
  const [highlightWord, setHighlightWord] = useState("");
  const [stylePreference, setStylePreference] = useState<
    "wired" | "business" | "monocle" | "swiss"
  >("wired");
  const [showMasthead, setShowMasthead] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showNoise, setShowNoise] = useState(true);
  const [showSeal, setShowSeal] = useState(true);

  const [svgCode, setSvgCode] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSafeZone, setShowSafeZone] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // 同步外部传入的标题
  useEffect(() => {
    if (initialTitle) {
      const clean = initialTitle.replace(/^[#>*_\-\s]+/, "").trim();
      setTitle(clean);
      if (!highlightWord) {
        setHighlightWord(clean.length > 6 ? clean.slice(clean.length - 4) : clean);
      }
    }
  }, [initialTitle]);

  // 切换风格 / 开关 / 输入修改：仅更新待选状态，不立即触发请求
  function handleStyleChange(style: "wired" | "business" | "monocle" | "swiss") {
    setStylePreference(style);
    setError(null);
  }

  function handleToggleOption(key: "masthead" | "barcode" | "noise" | "seal") {
    if (key === "masthead") setShowMasthead((v) => !v);
    else if (key === "barcode") setShowBarcode((v) => !v);
    else if (key === "noise") setShowNoise((v) => !v);
    else if (key === "seal") setShowSeal((v) => !v);
    setError(null);
  }

  // 唯一入口：AI 生成封面
  const handleAiGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "深度思考与知识沉淀",
          highlightWord,
          category,
          stylePreference,
          showMasthead,
          showBarcode,
          showNoise,
          showSeal,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.svg) {
        setSvgCode(data.svg);
      } else {
        setError(data?.error || "AI 生成封面失败，请重试。");
      }
    } catch (err) {
      console.error("AI 生成杂志封面失败:", err);
      setError("网络异常，AI 生成封面失败，请重试。");
    } finally {
      setGenerating(false);
    }
  }, [generating, title, highlightWord, category, stylePreference, showMasthead, showBarcode, showNoise, showSeal]);

  // 一键下载 PNG
  async function handleDownloadPng() {
    if (!svgCode) return;
    const cleanTitle = (title || "magazine-cover").replace(/[*_`~#\\/:]/g, "").trim().slice(0, 30);
    await downloadSvgAsPng(svgCode, `${cleanTitle}-杂志封面-900x383.png`, 2);
  }

  // 复制 PNG 图片
  async function handleCopyPng() {
    if (!svgCode) return;
    const ok = await copySvgAsPngToClipboard(svgCode, 2);
    if (ok) {
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    }
  }

  // 复制 SVG 源码
  function handleCopySvgCode() {
    if (!svgCode) return;
    navigator.clipboard.writeText(svgCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl">
        {/* 顶栏 */}
        <DialogHeader className="border-b px-5 py-3.5 bg-muted/20">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="size-4" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold">
                  杂志级公众号封面大图（2.35:1 · AI 生成）
                </DialogTitle>
                <DialogDescription className="text-xs">
                  由大模型按你的标题与版式偏好即时构思矢量封面 · 通过合规校验后出品
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSafeZone(!showSafeZone)}
                className={cn(
                  "h-7 text-xs gap-1 rounded-lg cursor-pointer",
                  showSafeZone && "bg-primary/10 text-primary font-medium"
                )}
                title="切换显示微信订阅号列表居中安全区辅助线"
              >
                {showSafeZone ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                <span>安全区辅助线</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCode(!showCode)}
                className={cn(
                  "h-7 text-xs gap-1 rounded-lg cursor-pointer",
                  showCode && "bg-primary/10 text-primary font-medium"
                )}
                title="查看或复制 SVG XML 源码"
              >
                <Code2 className="size-3.5" />
                <span>SVG 源码</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* 主体区 */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {/* 标题微调与生成按钮 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-8 flex items-center gap-2">
              <div className="relative flex-1">
                <Type className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setError(null); }}
                  placeholder="修改封面主标题…"
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-xl border bg-background font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="w-36 shrink-0">
                <input
                  type="text"
                  value={highlightWord}
                  onChange={(e) => { setHighlightWord(e.target.value); setError(null); }}
                  placeholder="高亮关键词…"
                  className="w-full h-8 px-2.5 text-xs rounded-xl border bg-background font-medium focus:outline-none focus:ring-1 focus:ring-primary text-emerald-600 dark:text-emerald-400"
                />
              </div>
            </div>

            <div className="md:col-span-4 flex justify-end">
              <Button
                variant="default"
                size="sm"
                onClick={handleAiGenerate}
                disabled={generating}
                className="h-8 text-xs gap-1.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs w-full sm:w-auto"
              >
                {generating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wand2 className="size-3.5" />
                )}
                <span>{generating ? "AI 生成中…" : svgCode ? "重新生成封面" : "AI 生成封面"}</span>
              </Button>
            </div>
          </div>

          {/* 4 大杂志风格选择 */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-xs font-semibold text-muted-foreground mr-1">杂志版式:</span>
            {MAGAZINE_STYLES.map((st) => {
              const isSelected = stylePreference === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleStyleChange(st.id as any)}
                  disabled={generating}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary shadow-2xs font-semibold ring-1 ring-primary/20"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <span className={cn("size-2.5 rounded-full border", st.color)} />
                  <span>{st.name}</span>
                </button>
              );
            })}
          </div>

          {/* 出版元素可控开关 */}
          <div className="flex items-center gap-2 flex-wrap pt-0.5 text-xs">
            <span className="font-semibold text-muted-foreground mr-1">出版元素:</span>
            {[
              { id: "masthead", label: "杂志刊头", active: showMasthead },
              { id: "barcode", label: "矢量条形码", active: showBarcode },
              { id: "noise", label: "胶片噪点微粒", active: showNoise },
              { id: "seal", label: "墨匠方印", active: showSeal },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleToggleOption(opt.id as any)}
                disabled={generating}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                  opt.active
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                    : "border-border text-muted-foreground/60 hover:text-muted-foreground bg-muted/20"
                )}
              >
                <Check className={cn("size-3", opt.active ? "opacity-100" : "opacity-0")} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SVG 视觉画布容器 */}
          <div className="relative w-full aspect-[900/383] rounded-2xl overflow-hidden border shadow-xl bg-black/90 flex items-center justify-center">
            {generating ? (
              <div className="flex flex-col items-center justify-center space-y-3 text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-primary" />
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold text-foreground">AI 正在构思杂志封面矢量隐喻……</p>
                  <p className="text-[11px] text-muted-foreground">遵循三层构图、配色克制与微信安全区规范生成</p>
                </div>
              </div>
            ) : svgCode ? (
              <>
                <div
                  className="w-full h-full flex items-center justify-center pointer-events-none select-none"
                  dangerouslySetInnerHTML={{ __html: svgCode }}
                />

                {/* 微信订阅号列表安全区辅助线 */}
                {showSafeZone && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-[84%] h-[84%] border-2 border-dashed border-rose-500/80 rounded-xl flex flex-col justify-between p-2.5">
                      <div className="flex items-center justify-between text-[10px] font-mono text-rose-400 bg-black/70 px-1.5 py-0.5 rounded w-fit">
                        微信居中安全区 (列表不裁切)
                      </div>
                      <div className="text-right text-[10px] font-mono text-rose-400 bg-black/70 px-1.5 py-0.5 rounded w-fit self-end">
                        900 × 383
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 p-8 text-center text-muted-foreground">
                <Sparkles className="size-9 text-emerald-500/40" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">等待 AI 生成封面</p>
                  <p className="text-xs text-muted-foreground">设定标题、高亮词、版式与出版元素后，点击右上角「AI 生成封面」</p>
                </div>
                <Button
                  size="sm"
                  onClick={handleAiGenerate}
                  disabled={generating}
                  className="text-xs gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer mt-1 font-semibold"
                >
                  <Wand2 className="size-3.5" />
                  <span>立即生成 2.35:1 杂志封面</span>
                </Button>
              </div>
            )}
          </div>

          {/* 展开查看 SVG 源码 */}
          {showCode && svgCode && (
            <div className="relative rounded-xl border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed max-h-44 overflow-y-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySvgCode}
                className="absolute top-2 right-2 h-6 text-[10px] gap-1 rounded bg-background/80"
              >
                {copiedCode ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                <span>{copiedCode ? "已复制源码" : "复制代码"}</span>
              </Button>
              <pre className="text-muted-foreground whitespace-pre-wrap select-text">{svgCode}</pre>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="border-t px-5 py-3 bg-muted/20 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-mono">微信标准比例: 2.35:1</span>
            <span>·</span>
            <span>导出分辨率: 1800 × 766 (超高清)</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPng}
              disabled={!svgCode || generating}
              className="gap-1.5 text-xs rounded-xl cursor-pointer"
            >
              {copiedImage ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              <span>{copiedImage ? "图片已复制到剪贴板！" : "一键复制图片"}</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleDownloadPng}
              disabled={!svgCode || generating}
              className="gap-1.5 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
            >
              <Download className="size-3.5" />
              <span>下载标准 PNG 封面</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}