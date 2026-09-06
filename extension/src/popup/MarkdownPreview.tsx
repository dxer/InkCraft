import { useMemo } from "react";
import { markdownToHtml } from "../lib/markdown";

/** 只读渲染视图：标题 / 表格 / 代码块 / 引用按排版展示 */
export function MarkdownPreview({ content }: { content: string }) {
  const html = useMemo(() => markdownToHtml(content), [content]);
  return (
    <div
      className="preview-body markdown-rendered"
      dangerouslySetInnerHTML={{ __html: html }}
      data-sel="preview-rendered"
    />
  );
}