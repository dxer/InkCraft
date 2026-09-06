export { cn } from "cn";

/**
 * Markdown 正文可见字数（粗略）：剥代码块 / 行内代码 / 链接 / 标题 / 强调标记后
 * 统计非空白字符数。用于字数统计场景（成果列表等），不追求逐字节精确。
 */
export function markdownLength(md: string): number {
   return md
      .replace(/```[\s\S]*?```/g, "") // 代码块
      .replace(/`[^`]*`/g, "") // 行内代码
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接/图片保留文字
      .replace(/^#{1,6}\s*/gm, "") // 标题标记
      .replace(/[*_>~-]/g, "") // 强调/引用等
      .replace(/\s+/g, "").length;
}
