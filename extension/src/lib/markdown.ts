import { marked } from "marked";
import DOMPurify from "dompurify";

// 全程同步处理，popup 与 content script 都可复用
marked.setOptions({ gfm: true, breaks: true });

/**
 * 将 Markdown 源码渲染为安全 HTML，供「阅读预览」视图使用。
 * - DOMPurify 兜底，防止站点源内容夹带恶意脚本
 * - 过滤远端图片，剪藏预览不主动加载原站图
 */
export function markdownToHtml(md: string): string {
  const raw = marked.parse(md || "", { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    FORBID_TAGS: ["img", "style", "script", "iframe", "form", "input", "button"],
  });
}

/**
 * 正文首个标题若与笔记标题重复（全等或互为包含），去掉它——
 * 笔记标题已单独存储展示，正文里再出现一遍只会造成重复（Defuddle 同款处理）。
 */
export function dropLeadingTitleHeading(md: string, title: string): string {
  const key = (s: string) => s.replace(/[\s#*_`~[\]()]/g, "").toLowerCase();
  const t = key(title || "");
  if (!t) return md;
  const m = md.match(/^\s{0,3}#{1,2}\s+(.+?)[ \t]*(?:\n|$)/);
  if (!m) return md;
  const h = key(m[1]);
  if (!h) return md;
  const dup =
    h === t ||
    (h.length >= 6 && t.includes(h)) ||
    (t.length >= 6 && h.includes(t));
  if (!dup) return md;
  return md.slice(m[0].length).replace(/^\n+/, "");
}