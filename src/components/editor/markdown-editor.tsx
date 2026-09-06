"use client";

import {
  Bold,
  Check,
  Code,
  Copy,
  CornerDownLeft,
  Eye,
  FileCode,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Quote,
  Sparkles,
  Strikethrough,
  X,
} from "lucide-react";
import { marked } from "marked";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MarkdownEditorProps {
  content: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  minHeight?: string;
}

export type ViewMode = "preview" | "edit";

interface ActionPreview {
  action: "expand" | "challenge" | "assess" | "refine";
  actionLabel: string;
  originalText: string;
  result: string;
  selectionStart: number;
  selectionEnd: number;
}

export function MarkdownEditor({
  content = "",
  onChange,
  placeholder = "以 Markdown 格式沉浸创作……",
  editable = true,
  className,
  minHeight = "480px",
}: MarkdownEditorProps) {
  const [val, setVal] = useState(content);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number; text: string }>({
    start: 0,
    end: 0,
    text: "",
  });

  // AI 智鉴安全网
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiPreview, setAiPreview] = useState<ActionPreview | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorId = useId();

  // 自动根据文章内容自适应撑开高度 (Auto-expanding)
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.max(el.scrollHeight, 450);
    el.style.height = `${nextHeight}px`;
  }, []);

  // 同步外部 content 变更
  useEffect(() => {
    if (content !== val) {
      setVal(content);
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // 内容或视图变更时自动撑开高度
  useEffect(() => {
    adjustHeight();
  }, [val, viewMode, adjustHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setVal(next);
    onChange?.(next);
    adjustHeight();
  };

  // 监听光标与选区更新
  const updateSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value.slice(start, end);
    setSelectedRange({ start, end, text });
  }, []);

  // 快捷插入 Markdown 语法
  const wrapOrInsert = (prefix: string, suffix: string = "", placeholderText: string = "") => {
    const el = textareaRef.current;
    if (!el || !editable) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentVal = el.value;
    const sel = currentVal.slice(start, end);

    const inserted = sel ? `${prefix}${sel}${suffix}` : `${prefix}${placeholderText}${suffix}`;
    const nextVal = currentVal.slice(0, start) + inserted + currentVal.slice(end);

    setVal(nextVal);
    onChange?.(nextVal);

    requestAnimationFrame(() => {
      el.focus();
      const newCursorStart = start + prefix.length;
      const newCursorEnd = sel ? start + prefix.length + sel.length : newCursorStart + placeholderText.length;
      el.setSelectionRange(newCursorStart, newCursorEnd);
      updateSelection();
    });
  };

  // 插入行前缀
  const insertLinePrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el || !editable) return;

    const start = el.selectionStart;
    const currentVal = el.value;
    const lineStart = currentVal.lastIndexOf("\n", start - 1) + 1;
    const nextVal = currentVal.slice(0, lineStart) + prefix + currentVal.slice(lineStart);

    setVal(nextVal);
    onChange?.(nextVal);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
      updateSelection();
    });
  };

  // 智能键入处理（Smart Enter / Auto-closing Pairs / Tab 缩进）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const mod = isMac ? e.metaKey : e.ctrlKey;
    const el = textareaRef.current;
    if (!el || !editable) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const currentVal = el.value;
    const hasSelection = end > start;
    const selectedText = currentVal.slice(start, end);

    // 1. 快捷键
    if (mod && e.key.toLowerCase() === "b") {
      e.preventDefault();
      wrapOrInsert("**", "**", "加粗文本");
      return;
    }
    if (mod && e.key.toLowerCase() === "i") {
      e.preventDefault();
      wrapOrInsert("*", "*", "斜体文本");
      return;
    }
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      wrapOrInsert("[", "](https://)", "链接描述");
      return;
    }

    // 2. 选区成对符号自动包裹
    const pairs: Record<string, [string, string]> = {
      "*": ["*", "*"],
      "_": ["_", "_"],
      "~": ["~~", "~~"],
      "[": ["[", "]"],
      "(": ["(", ")"],
      "{": ["{", "}"],
      '"': ['"', '"'],
      "'": ["'", "'"],
      "`": ["`", "`"],
    };

    if (hasSelection && pairs[e.key]) {
      e.preventDefault();
      const [p, s] = pairs[e.key];
      const nextVal = currentVal.slice(0, start) + p + selectedText + s + currentVal.slice(end);
      setVal(nextVal);
      onChange?.(nextVal);
      requestAnimationFrame(() => {
        el.setSelectionRange(start + p.length, end + p.length);
        updateSelection();
      });
      return;
    }

    // 3. Tab 键缩进与反缩进
    if (e.key === "Tab") {
      e.preventDefault();
      if (!e.shiftKey) {
        // 缩进 2 空格
        const nextVal = currentVal.slice(0, start) + "  " + currentVal.slice(end);
        setVal(nextVal);
        onChange?.(nextVal);
        requestAnimationFrame(() => {
          el.setSelectionRange(start + 2, start + 2);
        });
      } else {
        // 反缩进
        const lineStart = currentVal.lastIndexOf("\n", start - 1) + 1;
        if (currentVal.slice(lineStart, lineStart + 2) === "  ") {
          const nextVal = currentVal.slice(0, lineStart) + currentVal.slice(lineStart + 2);
          setVal(nextVal);
          onChange?.(nextVal);
          requestAnimationFrame(() => {
            el.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2));
          });
        }
      }
      return;
    }

    // 4. 智能回车 (Smart Enter for lists and blockquotes)
    if (e.key === "Enter" && !e.shiftKey) {
      const lineStart = currentVal.lastIndexOf("\n", start - 1) + 1;
      const currentLine = currentVal.slice(lineStart, start);

      // 任务列表 `- [ ] ` 或 `- [x] `
      const taskMatch = currentLine.match(/^(\s*-\s*\[[ xX]\]\s+)(.*)$/);
      if (taskMatch) {
        e.preventDefault();
        const prefix = taskMatch[1];
        const contentAfter = taskMatch[2];
        if (!contentAfter.trim()) {
          // 空任务行按回车：清除该行前缀退出任务列表
          const nextVal = currentVal.slice(0, lineStart) + currentVal.slice(start);
          setVal(nextVal);
          onChange?.(nextVal);
          requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
        } else {
          // 续行任务
          const insertStr = "\n- [ ] ";
          const nextVal = currentVal.slice(0, start) + insertStr + currentVal.slice(end);
          setVal(nextVal);
          onChange?.(nextVal);
          requestAnimationFrame(() => {
            const nextCursor = start + insertStr.length;
            el.setSelectionRange(nextCursor, nextCursor);
          });
        }
        return;
      }

      // 有序列表 `1. `
      const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (orderedMatch) {
        e.preventDefault();
        const indent = orderedMatch[1];
        const num = parseInt(orderedMatch[2], 10);
        const contentAfter = orderedMatch[3];
        if (!contentAfter.trim()) {
          // 空有序列表行按回车：退出列表
          const nextVal = currentVal.slice(0, lineStart) + currentVal.slice(start);
          setVal(nextVal);
          onChange?.(nextVal);
          requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
        } else {
          const insertStr = `\n${indent}${num + 1}. `;
          const nextVal = currentVal.slice(0, start) + insertStr + currentVal.slice(end);
          setVal(nextVal);
          onChange?.(nextVal);
          requestAnimationFrame(() => {
            const nextCursor = start + insertStr.length;
            el.setSelectionRange(nextCursor, nextCursor);
          });
        }
        return;
      }

      // 无序列表 `- ` 或 `* `
      const bulletMatch = currentLine.match(/^(\s*[-*]\s+)(.*)$/);
      if (bulletMatch) {
        e.preventDefault();
        const prefix = bulletMatch[1];
        const contentAfter = bulletMatch[2];
        if (!contentAfter.trim()) {
          // 空列表行按回车：退出无序列表
          const nextVal = currentVal.slice(0, lineStart) + currentVal.slice(start);
          setVal(nextVal);
          onChange?.(nextVal);
          requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
        } else {
          const insertStr = `\n${prefix}`;
          const nextVal = currentVal.slice(0, start) + insertStr + currentVal.slice(end);
          setVal(nextVal);
          onChange?.(nextVal);
          requestAnimationFrame(() => {
            const nextCursor = start + insertStr.length;
            el.setSelectionRange(nextCursor, nextCursor);
          });
        }
        return;
      }

      // 引用块 `> `
      const quoteMatch = currentLine.match(/^(\s*>\s+)(.*)$/);
      if (quoteMatch) {
        e.preventDefault();
        const prefix = quoteMatch[1];
        const contentAfter = quoteMatch[2];
        if (!contentAfter.trim()) {
          // 空引用行按回车：退出引用
          const nextVal = currentVal.slice(0, lineStart) + currentVal.slice(start);
          setVal(nextVal);
          onChange?.(nextVal);
          requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
        } else {
          const insertStr = `\n${prefix}`;
          const nextVal = currentVal.slice(0, start) + insertStr + currentVal.slice(end);
          setVal(nextVal);
          onChange?.(nextVal);
          requestAnimationFrame(() => {
            const nextCursor = start + insertStr.length;
            el.setSelectionRange(nextCursor, nextCursor);
          });
        }
        return;
      }
    }
  };

  // 触发 AI 智鉴推敲
  async function handleTriggerAi(
    action: "expand" | "challenge" | "assess" | "refine",
    label: string
  ) {
    const textToAnalyze = selectedRange.text.trim() || val.slice(0, 500);
    if (!textToAnalyze) return;

    setLoadingAi(true);
    setAiPreview(null);

    try {
      const res = await fetch("/api/workshop/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          selectedText: textToAnalyze,
          context: `全局上下文：\n${val.slice(0, 1500)}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiPreview({
          action,
          actionLabel: label,
          originalText: textToAnalyze,
          result: data.result,
          selectionStart: selectedRange.start,
          selectionEnd: selectedRange.end,
        });
      }
    } catch (err) {
      console.error("AI 智鉴推敲失败", err);
    } finally {
      setLoadingAi(false);
    }
  }

  // 采纳 AI 替换
  function handleApplyAiReplace() {
    if (!aiPreview || !editable) return;
    const start = aiPreview.selectionStart;
    const end = aiPreview.selectionEnd;

    let nextVal = val;
    if (end > start) {
      nextVal = val.slice(0, start) + aiPreview.result + val.slice(end);
    } else {
      nextVal = val + "\n\n" + aiPreview.result;
    }

    setVal(nextVal);
    onChange?.(nextVal);
    setAiPreview(null);
  }

  // 采纳 AI 插入下方
  function handleApplyAiInsert() {
    if (!aiPreview || !editable) return;
    const end = aiPreview.selectionEnd > 0 ? aiPreview.selectionEnd : val.length;
    const nextVal = val.slice(0, end) + "\n\n" + aiPreview.result + "\n" + val.slice(end);

    setVal(nextVal);
    onChange?.(nextVal);
    setAiPreview(null);
  }

  // 复制 Markdown 源码
  function copyMarkdown() {
    navigator.clipboard.writeText(val);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  }

  // Markdown HTML 渲染
  const renderedHtml = React.useMemo(() => {
    try {
      return marked.parse(val || "", { gfm: true, breaks: true }) as string;
    } catch {
      return val;
    }
  }, [val]);

  return (
    <div
      className={cn(
        "flex flex-col w-full bg-transparent transition-all",
        isFullscreen && "fixed inset-0 z-50 bg-background p-6",
        className
      )}
    >
      {/* 极简无界顶部排版工具栏 */}
      <div className="flex flex-wrap items-center justify-between py-1.5 px-0.5 gap-2 text-xs border-b border-border/20 mb-2">
        {/* 左侧：轻量排版格式按钮组 */}
        <div className="flex flex-wrap items-center gap-0.5">
          {editable && (
            <>
              <button
                type="button"
                onClick={() => wrapOrInsert("**", "**", "加粗文本")}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="加粗 (Ctrl+B)"
              >
                <Bold className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapOrInsert("*", "*", "斜体文本")}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="斜体 (Ctrl+I)"
              >
                <Italic className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapOrInsert("~~", "~~", "删除线")}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="删除线"
              >
                <Strikethrough className="size-3.5" />
              </button>

              <div className="mx-1 h-3 w-px bg-border/40" />

              <button
                type="button"
                onClick={() => insertLinePrefix("# ")}
                className="px-1 py-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors font-bold text-[11px]"
                title="一级标题 H1"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => insertLinePrefix("## ")}
                className="px-1 py-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors font-bold text-[11px]"
                title="二级标题 H2"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => insertLinePrefix("### ")}
                className="px-1 py-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors font-bold text-[11px]"
                title="三级标题 H3"
              >
                H3
              </button>

              <div className="mx-1 h-3 w-px bg-border/40" />

              <button
                type="button"
                onClick={() => insertLinePrefix("> ")}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="引用块"
              >
                <Quote className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapOrInsert("`", "`", "代码")}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="行内代码"
              >
                <Code className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapOrInsert("```\n", "\n```", "代码片段")}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="代码块"
              >
                <FileCode className="size-3.5" />
              </button>

              <div className="mx-1 h-3 w-px bg-border/40" />

              <button
                type="button"
                onClick={() => insertLinePrefix("- ")}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="无序列表"
              >
                <List className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertLinePrefix("1. ")}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="有序列表"
              >
                <ListOrdered className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertLinePrefix("- [ ] ")}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="任务清单"
              >
                <ListTodo className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => wrapOrInsert("[", "](https://)", "链接描述")}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="插入链接 (Ctrl+K)"
              >
                <Link2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertLinePrefix("\n---\n")}
                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                title="分割线"
              >
                <Minus className="size-3.5" />
              </button>
            </>
          )}

          {/* 划词 AI 智鉴灵动悬浮条 */}
          {selectedRange.text.trim().length > 0 && editable && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-primary/30 animate-in fade-in-0 zoom-in-95">
              <span className="text-[10px] font-semibold text-primary flex items-center gap-0.5">
                <Sparkles className="size-3" />
                推敲:
              </span>
              <button
                type="button"
                onClick={() => handleTriggerAi("expand", "延展")}
                disabled={loadingAi}
                className="px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                延展
              </button>
              <button
                type="button"
                onClick={() => handleTriggerAi("challenge", "反辩")}
                disabled={loadingAi}
                className="px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                反辩
              </button>
              <button
                type="button"
                onClick={() => handleTriggerAi("assess", "解构")}
                disabled={loadingAi}
                className="px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                解构
              </button>
              <button
                type="button"
                onClick={() => handleTriggerAi("refine", "精炼")}
                disabled={loadingAi}
                className="px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                精炼
              </button>
            </div>
          )}
        </div>

        {/* 右侧：视图切换、全屏与复制 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyMarkdown}
            className="h-6 px-1.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-1 transition-colors"
            title="复制 Markdown"
          >
            {copiedMd ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            <span>{copiedMd ? "已复制" : "复制"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title={isFullscreen ? "退出全屏" : "全屏专注模式"}
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>

          <div className="flex items-center rounded-md bg-muted/40 p-0.5 ml-1">
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={cn(
                "flex items-center gap-1 rounded px-2.5 py-0.5 text-[11px] transition-colors",
                viewMode === "preview"
                  ? "bg-background text-foreground shadow-2xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="预览排版"
            >
              <Eye className="size-3" />
              <span>预览</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={cn(
                "flex items-center gap-1 rounded px-2.5 py-0.5 text-[11px] transition-colors",
                viewMode === "edit"
                  ? "bg-background text-foreground shadow-2xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="编辑 Markdown"
            >
              <FileText className="size-3" />
              <span>编辑</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI 智鉴安全网卡片 */}
      {aiPreview && (
        <Card className="my-2 border-primary/25 bg-muted/20 p-3.5 rounded-lg text-xs space-y-2 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
            <div className="flex items-center gap-1 font-semibold text-primary">
              <Sparkles className="size-3.5" />
              <span>智鉴推敲 · {aiPreview.actionLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => setAiPreview(null)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="rounded bg-background/60 p-2 text-muted-foreground space-y-0.5">
            <div className="text-[10px] font-semibold text-muted-foreground">原句：</div>
            <div className="italic line-clamp-2">“{aiPreview.originalText}”</div>
          </div>

          <div className="rounded bg-primary/[0.04] border border-primary/20 p-2.5 space-y-0.5">
            <div className="text-[10px] font-semibold text-primary">AI 建议：</div>
            <div className="text-foreground whitespace-pre-wrap leading-relaxed">
              {aiPreview.result}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAiPreview(null)}
              className="h-6 text-xs text-muted-foreground"
            >
              放弃
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleApplyAiInsert}
              className="h-6 text-xs gap-1"
            >
              <CornerDownLeft className="size-3" />
              插入下方
            </Button>
            <Button
              size="sm"
              onClick={handleApplyAiReplace}
              className="h-6 text-xs gap-1 bg-foreground text-background hover:bg-foreground/90 font-medium"
            >
              <Check className="size-3" />
              采纳替换
            </Button>
          </div>
        </Card>
      )}

      {loadingAi && (
        <div className="my-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-primary animate-pulse">
          <Loader2 className="size-3.5 animate-spin" />
          <span>正在对选中文本进行智鉴推敲...</span>
        </div>
      )}

      {/* 主体编辑与预览区（完全无边框设计，高度随文章内容自适应撑开） */}
      <div
        className={cn(
          "flex flex-1 w-full",
          isFullscreen && "max-w-4xl mx-auto"
        )}
        style={{ minHeight }}
      >
        {/* 编辑模式 */}
        {viewMode === "edit" ? (
          <div className="relative flex-1 flex flex-col bg-transparent">
            <textarea
              ref={textareaRef}
              id={editorId}
              value={val}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onSelect={updateSelection}
              onKeyUp={updateSelection}
              onClick={updateSelection}
              placeholder={placeholder}
              readOnly={!editable}
              spellCheck={false}
              className="w-full resize-none py-2 px-0 font-sans text-base leading-relaxed text-foreground bg-transparent outline-none border-none overflow-hidden placeholder:text-muted-foreground/40"
              style={{
                fontFamily:
                  'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "HarmonyOS Sans SC", sans-serif',
                lineHeight: "1.85",
              }}
            />
          </div>
        ) : (
          /* 预览模式（默认展示） */
          <div
            ref={previewRef}
            className="flex-1 py-2 bg-transparent"
          >
            {val.trim() ? (
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-muted-foreground/40 italic">
                暂无内容预览
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
