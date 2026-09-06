import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export interface ClipResult {
  title: string;
  content: string;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** 网页剪藏：抓取 HTML → Readability 提取正文 → 块级元素拼接为分段纯文本 */
export async function clipUrl(url: string): Promise<ClipResult> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`抓取失败：HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml|text\/plain/.test(contentType)) {
    throw new Error(`暂不支持的内容类型：${contentType || "未知"}`);
  }
  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  const fallbackText = article?.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";
  if (!article || !fallbackText) throw new Error("未能从页面中提取正文");

  const blockText = extractBlocks(article.content);
  return {
    title: (article.title || new URL(url).hostname).trim(),
    content: blockText || fallbackText,
  };
}

/** 把 Readability 输出的正文 HTML 转为保留段落结构的纯文本 */
function extractBlocks(html: string | null | undefined): string {
  if (!html) return "";
  const doc = new JSDOM(html).window.document;
  doc.querySelectorAll("script,style,noscript").forEach((el) => el.remove());
  const parts: string[] = [];
  for (const el of doc.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre")) {
    // 嵌套结构只取最外层（p 在 blockquote 内、li 在嵌套列表内不重复计）
    if (el.parentElement?.closest("blockquote,li,td,pre")) continue;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const tag = el.tagName.toLowerCase();
    parts.push(tag.startsWith("h") ? `## ${text}` : text);
  }
  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
