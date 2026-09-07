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

/**
 * 未填写标题时的兜底：取正文开头一段作为标题（去开头标题标记、折叠空白，超长截断加省略号）。
 */
export function deriveTitleFromContent(content: string, max = 30): string {
   const text = content
      .replace(/^#{1,6}\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
   if (!text) return "";
   return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * 紧凑相对时间：刚刚 / N 分钟前 / N 小时前 / 昨天 / N 天前 / 今年内 M/D / 更早 Y/M/D。
 * 容忍“2026-09-06 12:00:00”这类无 T 的存量时间串。
 */
export function formatCompactTime(raw: string): string {
   if (!raw) return "";
   const d = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
   if (Number.isNaN(d.getTime())) return raw;

   const now = new Date();
   const diffMs = now.getTime() - d.getTime();
   const diffSecs = Math.floor(diffMs / 1000);
   const diffMins = Math.floor(diffSecs / 60);
   const diffHours = Math.floor(diffMins / 60);
   const diffDays = Math.floor(diffHours / 24);

   if (diffSecs < 60 && diffSecs >= 0) {
      return "刚刚";
   }
   if (diffMins < 60 && diffMins > 0) {
      return `${diffMins} 分钟前`;
   }
   if (diffHours < 24 && diffHours > 0) {
      return `${diffHours} 小时前`;
   }
   if (diffDays === 1) {
      return "昨天";
   }
   if (diffDays < 7 && diffDays > 1) {
      return `${diffDays} 天前`;
   }

   if (d.getFullYear() === now.getFullYear()) {
      return `${d.getMonth() + 1}/${d.getDate()}`;
   }
   return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
