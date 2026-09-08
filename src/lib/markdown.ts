import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

/**
 * Markdown → 安全 HTML。
 * 渲染结果一律进 dangerouslySetInnerHTML，而内容来源包括插件剪藏的任意网页、
 * AI 生成文本与手动粘贴——全部视为不可信，必须经 DOMPurify 消毒后再入 DOM，
 * 否则构成存储型 XSS（脚本可同源带会话 Cookie 调用全部 API）。
 */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown || "", { gfm: true, breaks: true }) as string;
  return DOMPurify.sanitize(html);
}

/** HTML 文本转义：把不可信文本安全拼入 innerHTML 前调用（如搜索高亮片段） */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
