import { marked } from "marked";

export interface WeChatFormatOptions {
  theme?: "emerald" | "ink" | "warm";
  title?: string;
}

/**
 * 将 Markdown 转化为内联 CSS 样式的 HTML，高度兼容微信公众号后台富文本编辑器
 */
export function formatToWeChatHtml(markdown: string, options: WeChatFormatOptions = {}): string {
  if (!markdown || !markdown.trim()) return "";

  const theme = options.theme || "emerald";

  const themeColors = {
    emerald: {
      primary: "#07c160",
      primaryBg: "#f0f9eb",
      text: "#333333",
      heading: "#111827",
      quoteBg: "#f7f9fa",
      codeBg: "#282c34",
      codeText: "#abb2bf",
      border: "#e5e7eb",
    },
    ink: {
      primary: "#18181b",
      primaryBg: "#f4f4f5",
      text: "#27272a",
      heading: "#09090b",
      quoteBg: "#fafafa",
      codeBg: "#1e1e1e",
      codeText: "#d4d4d8",
      border: "#e4e4e7",
    },
    warm: {
      primary: "#d97706",
      primaryBg: "#fef3c7",
      text: "#451a03",
      heading: "#78350f",
      quoteBg: "#fffbeb",
      codeBg: "#292524",
      codeText: "#e7e5e4",
      border: "#fde68a",
    },
  }[theme];

  // 解析基础 HTML
  let html = marked.parse(markdown, { gfm: true, breaks: true }) as string;

  // 内联替换所有常见标签以保证微信编辑器完全兼容（微信粘贴时通常会过滤掉 <style> 块）
  html = html
    // H1 标题
    .replace(
      /<h1>(.*?)<\/h1>/gi,
      `<h1 style="font-size: 20px; font-weight: 700; color: ${themeColors.heading}; margin: 28px 0 16px 0; line-height: 1.4; text-align: left; padding-bottom: 6px; border-bottom: 2px solid ${themeColors.primary};">$1</h1>`
    )
    // H2 标题
    .replace(
      /<h2>(.*?)<\/h2>/gi,
      `<h2 style="font-size: 17px; font-weight: 700; color: ${themeColors.heading}; margin: 24px 0 14px 0; line-height: 1.4; padding-left: 10px; border-left: 4px solid ${themeColors.primary};">$1</h2>`
    )
    // H3 标题
    .replace(
      /<h3>(.*?)<\/h3>/gi,
      `<h3 style="font-size: 15px; font-weight: 700; color: ${themeColors.heading}; margin: 20px 0 10px 0; line-height: 1.4;">$1</h3>`
    )
    // 段落 P
    .replace(
      /<p>(.*?)<\/p>/gi,
      `<p style="font-size: 15px; color: ${themeColors.text}; line-height: 1.85; margin: 0 0 18px 0; text-align: justify; letter-spacing: 0.5px; word-break: break-word;">$1</p>`
    )
    // 引用块 Blockquote
    .replace(
      /<blockquote>([\s\S]*?)<\/blockquote>/gi,
      `<blockquote style="margin: 20px 0; padding: 14px 18px; background-color: ${themeColors.quoteBg}; border-left: 4px solid ${themeColors.primary}; color: #555555; font-size: 14px; line-height: 1.75; border-radius: 4px;">$1</blockquote>`
    )
    // 强调 Strong / Bold
    .replace(
      /<strong>(.*?)<\/strong>/gi,
      `<strong style="font-weight: 700; color: ${themeColors.heading}; background-color: ${themeColors.primaryBg}; padding: 1px 4px; border-radius: 3px;">$1</strong>`
    )
    // 无序列表 UL
    .replace(
      /<ul>([\s\S]*?)<\/ul>/gi,
      `<ul style="margin: 0 0 18px 0; padding-left: 22px; font-size: 15px; line-height: 1.8; color: ${themeColors.text}; list-style-type: disc;">$1</ul>`
    )
    // 有序列表 OL
    .replace(
      /<ol>([\s\S]*?)<\/ol>/gi,
      `<ol style="margin: 0 0 18px 0; padding-left: 22px; font-size: 15px; line-height: 1.8; color: ${themeColors.text};">$1</ol>`
    )
    // 列表项 LI
    .replace(
      /<li>(.*?)<\/li>/gi,
      `<li style="margin-bottom: 8px; line-height: 1.8; color: ${themeColors.text};">$1</li>`
    )
    // 分割线 HR
    .replace(
      /<hr\s*\/?>/gi,
      `<hr style="border: none; height: 1px; background-color: ${themeColors.border}; margin: 30px 0;" />`
    )
    // 代码块 Pre Code
    .replace(
      /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi,
      `<pre style="margin: 20px 0; padding: 14px 16px; background-color: ${themeColors.codeBg}; color: ${themeColors.codeText}; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 13px; line-height: 1.6; border-radius: 6px; overflow-x: auto; -webkit-overflow-scrolling: touch;"><code>$2</code></pre>`
    )
    // 行内代码 Code
    .replace(
      /<code>(.*?)<\/code>/gi,
      `<code style="font-family: Consolas, Monaco, monospace; font-size: 13px; background-color: #f1f3f5; color: #d63384; padding: 2px 6px; border-radius: 4px; margin: 0 2px;">$1</code>`
    );

  return `<section style="font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.85; color: ${themeColors.text}; letter-spacing: 0.5px; padding: 12px 2px; max-width: 100%;">
${html}
</section>`;
}

/**
 * 将 Markdown 一键以微信富文本格式写入剪贴板
 */
export async function copyWeChatRichText(
  markdown: string,
  options: WeChatFormatOptions = {}
): Promise<boolean> {
  if (!markdown || !markdown.trim()) return false;
  const html = formatToWeChatHtml(markdown, options);

  try {
    const blobHtml = new Blob([html], { type: "text/html" });
    const blobText = new Blob([markdown], { type: "text/plain" });
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": blobHtml,
        "text/plain": blobText,
      }),
    ]);
    return true;
  } catch {
    // 降级支持
    try {
      await navigator.clipboard.writeText(html);
      return true;
    } catch {
      return false;
    }
  }
}
