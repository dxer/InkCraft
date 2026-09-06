export interface QuoteCardOptions {
  quote: string;
  sourceTitle?: string;
  authorOrTopic?: string;
  theme?: "ink" | "sunset" | "ocean";
  badgeText?: string;
}

export const QUOTE_CARD_THEMES = {
  ink: {
    id: "ink",
    name: "墨黑雅金",
    bgStart: "#18181b",
    bgEnd: "#09090b",
    cardBg: "rgba(39, 39, 42, 0.65)",
    cardBorder: "rgba(244, 244, 245, 0.12)",
    textPrimary: "#f4f4f5",
    textSecondary: "#a1a1aa",
    accent: "#fbbf24", // 雅金
    quoteColor: "rgba(251, 191, 36, 0.25)",
    sealBg: "#dc2626",
    sealText: "#ffffff",
  },
  sunset: {
    id: "sunset",
    name: "暖杏日落",
    bgStart: "#fff7ed",
    bgEnd: "#ffedd5",
    cardBg: "rgba(255, 255, 255, 0.85)",
    cardBorder: "rgba(251, 146, 60, 0.2)",
    textPrimary: "#431407",
    textSecondary: "#78350f",
    accent: "#ea580c",
    quoteColor: "rgba(234, 88, 12, 0.15)",
    sealBg: "#ea580c",
    sealText: "#ffffff",
  },
  ocean: {
    id: "ocean",
    name: "深海极光",
    bgStart: "#0f172a",
    bgEnd: "#020617",
    cardBg: "rgba(30, 41, 59, 0.7)",
    cardBorder: "rgba(56, 189, 248, 0.2)",
    textPrimary: "#f8fafc",
    textSecondary: "#94a3b8",
    accent: "#38bdf8",
    quoteColor: "rgba(56, 189, 248, 0.2)",
    sealBg: "#0284c7",
    sealText: "#ffffff",
  },
} as const;

/**
 * 自动计算文字折行
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    let currentLine = "";
    for (let i = 0; i < para.length; i++) {
      const char = para[i];
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * 绘制圆角矩形
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 渲染 3:4 比例的高清小红书金句卡片到 HTML Canvas
 */
export function renderQuoteCard(
  canvas: HTMLCanvasElement,
  options: QuoteCardOptions
): void {
  const width = 900;
  const height = 1200; // 3:4 标准比例
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const themeKey = options.theme || "ink";
  const theme = QUOTE_CARD_THEMES[themeKey];

  // 1. 绘制背景渐变
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, theme.bgStart);
  bgGrad.addColorStop(1, theme.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. 绘制微光网格/装饰点
  ctx.fillStyle = theme.quoteColor;
  for (let i = 40; i < width; i += 60) {
    for (let j = 40; j < height; j += 60) {
      ctx.beginPath();
      ctx.arc(i, j, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. 绘制中央高质感卡片容器
  const marginX = 56;
  const marginY = 64;
  const cardW = width - marginX * 2;
  const cardH = height - marginY * 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 16;

  roundRect(ctx, marginX, marginY, cardW, cardH, 28);
  ctx.fillStyle = theme.cardBg;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = theme.cardBorder;
  ctx.stroke();
  ctx.restore();

  // 4. 绘制头部顶栏（印章 + 徽章 + 来源）
  const headerY = marginY + 48;
  const contentLeft = marginX + 48;
  const contentRight = marginX + cardW - 48;
  const contentWidth = contentRight - contentLeft;

  // 印章 Logo
  const sealSize = 34;
  roundRect(ctx, contentLeft, headerY - 6, sealSize, sealSize, 8);
  ctx.fillStyle = theme.sealBg;
  ctx.fill();
  ctx.fillStyle = theme.sealText;
  ctx.font = "bold 18px 'PingFang SC', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("匠", contentLeft + sealSize / 2, headerY - 6 + sealSize / 2);

  // 品牌文字
  ctx.textAlign = "left";
  ctx.fillStyle = theme.textPrimary;
  ctx.font = "bold 20px 'PingFang SC', sans-serif";
  ctx.fillText("墨匠 · 知识金句", contentLeft + sealSize + 14, headerY + 12);

  // 徽章 Tag（如小红书/洞察）
  const badgeText = options.badgeText || "核心洞察";
  ctx.font = "bold 13px 'PingFang SC', sans-serif";
  const badgeMetrics = ctx.measureText(badgeText);
  const badgeW = badgeMetrics.width + 20;
  const badgeH = 28;
  const badgeX = contentRight - badgeW;

  roundRect(ctx, badgeX, headerY - 4, badgeW, badgeH, 14);
  ctx.fillStyle = theme.quoteColor;
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = theme.accent;
  ctx.textAlign = "center";
  ctx.fillText(badgeText, badgeX + badgeW / 2, headerY + 12);

  // 5. 绘制超大背景引号装饰 “
  ctx.fillStyle = theme.quoteColor;
  ctx.font = "bold 140px 'Georgia', serif";
  ctx.textAlign = "left";
  ctx.fillText("“", contentLeft - 8, headerY + 150);

  // 6. 绘制核心金句正文
  const rawQuote = (options.quote || "文字是思考的容器，把原料锻造成作品。").trim();
  const quoteFontSize = rawQuote.length > 120 ? 32 : rawQuote.length > 60 ? 36 : 42;
  const lineHeight = quoteFontSize * 1.65;

  ctx.font = `600 ${quoteFontSize}px 'PingFang SC', 'Hiragino Sans GB', sans-serif`;
  const quoteLines = wrapText(ctx, rawQuote, contentWidth);

  let currentTextY = headerY + 140;
  ctx.fillStyle = theme.textPrimary;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  for (let i = 0; i < Math.min(quoteLines.length, 12); i++) {
    ctx.fillText(quoteLines[i], contentLeft, currentTextY);
    currentTextY += lineHeight;
  }

  // 7. 绘制来源/切角补充（如果有）
  if (options.sourceTitle || options.authorOrTopic) {
    currentTextY += 24;
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(contentLeft, currentTextY);
    ctx.lineTo(contentLeft + 80, currentTextY);
    ctx.stroke();

    currentTextY += 32;
    if (options.sourceTitle) {
      ctx.fillStyle = theme.textSecondary;
      ctx.font = "16px 'PingFang SC', sans-serif";
      const sourceLine = `出处：${options.sourceTitle}`;
      const srcLines = wrapText(ctx, sourceLine, contentWidth);
      ctx.fillText(srcLines[0], contentLeft, currentTextY);
      currentTextY += 26;
    }

    if (options.authorOrTopic) {
      ctx.fillStyle = theme.accent;
      ctx.font = "bold 15px 'PingFang SC', sans-serif";
      ctx.fillText(`🎯 ${options.authorOrTopic}`, contentLeft, currentTextY);
    }
  }

  // 8. 绘制底部水印栏
  const footerY = marginY + cardH - 44;
  ctx.strokeStyle = theme.cardBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(contentLeft, footerY - 24);
  ctx.lineTo(contentRight, footerY - 24);
  ctx.stroke();

  ctx.fillStyle = theme.textSecondary;
  ctx.font = "14px 'PingFang SC', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("InkCraft Local Content Studio", contentLeft, footerY);

  const dateStr = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  ctx.textAlign = "right";
  ctx.fillText(dateStr, contentRight, footerY);
}

/**
 * 导出 Canvas 为图片数据 URL
 */
export function getQuoteCardDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png", 0.95);
}

/**
 * 触发图片下载
 */
export function downloadQuoteCardImage(
  canvas: HTMLCanvasElement,
  filename = "inkcraft-quote-card.png"
): void {
  const url = getQuoteCardDataUrl(canvas);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * 一键复制图片到剪贴板
 */
export async function copyQuoteCardImageToClipboard(
  canvas: HTMLCanvasElement
): Promise<boolean> {
  try {
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          resolve(false);
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": blob,
            }),
          ]);
          resolve(true);
        } catch {
          resolve(false);
        }
      }, "image/png");
    });
  } catch {
    return false;
  }
}
