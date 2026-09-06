export const dynamic = "force-dynamic";

/**
 * 金句卡 SVG 生成端点（基于标准 SVG 矢量渲染，零外部字体网络依赖，Docker 容器内 100% 独立稳定）
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quote = searchParams.get("quote") || "知识管理的目标不是记住，而是把原料锻造成作品。";
  const author = searchParams.get("author") || "墨匠 · 现代内容工坊";

  // 包装换行
  const quoteLines = wrapText(quote, 18);

  const svg = `
<svg width="600" height="400" viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="50%" stop-color="#27272a"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f43f5e"/>
      <stop offset="100%" stop-color="#fb923c"/>
    </linearGradient>
  </defs>

  <!-- 背景 -->
  <rect width="600" height="400" rx="20" fill="url(#bg)"/>

  <!-- 装饰边框 -->
  <rect x="20" y="20" width="560" height="360" rx="14" fill="none" stroke="#3f3f46" stroke-width="1.5" stroke-dasharray="6,6"/>

  <!-- 顶部 Tag -->
  <rect x="40" y="44" width="90" height="24" rx="12" fill="url(#accent)"/>
  <text x="85" y="60" fill="#ffffff" font-size="11" font-weight="bold" font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif" text-anchor="middle">金句卡片</text>

  <text x="560" y="60" fill="#71717a" font-size="11" font-family="-apple-system, BlinkMacSystemFont, sans-serif" text-anchor="end">INKCRAFT · SHOT</text>

  <!-- 引用引号 -->
  <text x="40" y="130" fill="#f43f5e" font-size="48" font-family="Georgia, serif" opacity="0.6">“</text>

  <!-- 金句正文 -->
  ${quoteLines
    .map(
      (line, i) =>
        `<text x="50" y="${160 + i * 36}" fill="#f4f4f5" font-size="20" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif">${escapeXml(line)}</text>`
    )
    .join("\n")}

  <!-- 底部署名：墨匠印章 Logo + 署名 -->
  <line x1="40" y1="330" x2="560" y2="330" stroke="#27272a" stroke-width="1"/>
  <g transform="translate(40,343.5) scale(0.5)">
    <rect width="32" height="32" rx="7.2" fill="#f4f4f5"/>
    <path d="M16 4.6C17.7 9.1 21.9 11.6 21.9 16.9A5.9 5.9 0 1 1 10.1 16.9C10.1 11.6 14.3 9.1 16 4.6Z" fill="#18181b"/>
    <rect x="8.2" y="25.5" width="15.6" height="3" rx="1.5" fill="#18181b"/>
  </g>
  <text x="64" y="356" fill="#a1a1aa" font-size="12" font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif">${escapeXml(author)}</text>
  <text x="560" y="356" fill="#f43f5e" font-size="12" font-weight="bold" font-family="-apple-system, BlinkMacSystemFont, sans-serif" text-anchor="end">#深度思考</text>
</svg>
  `.trim();

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function wrapText(str: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const char of str) {
    current += char;
    if (current.length >= maxCharsPerLine) {
      lines.push(current);
      current = "";
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
