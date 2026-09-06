/**
 * SVG 封面工具库：AI 生成 SVG 的清洗与合规校验 + PNG 导出。
 * 注意：墨匠封面由 AI 模式生成，不内建本地模板；本文件只负责「清洗 / 校验 / 导出」。
 */

export interface CoverOptions {
  title?: string;
  highlightWord?: string;
  category?: string;
  stylePreference?: "wired" | "business" | "monocle" | "swiss";
  showMasthead?: boolean;
  showBarcode?: boolean;
  showNoise?: boolean;
  showSeal?: boolean;
}

/** 公众号封面标准 viewBox（2.35:1），校验并导出时使用 */
export const COVER_VIEWBOX = "900 383";
export const COVER_WIDTH = 900;
export const COVER_HEIGHT = 383;

/** 标准全平台兼容中文字体栈（PingFang 仅 macOS/iOS，需跟随后续字体保证 Win/Linux 渲染） */
export const CN_FONT_STACK =
  "'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif";

/**
 * 提取并清理纯净的 SVG 代码
 */
export function extractCleanSvg(rawText: string): string | null {
  if (!rawText) return null;
  let clean = rawText.replace(/```xml/gi, "").replace(/```svg/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("<svg");
  const end = clean.lastIndexOf("</svg>");
  if (start === -1 || end === -1 || end <= start) return null;
  clean = clean.slice(start, end + 6);
  if (!clean.includes('xmlns="http://www.w3.org/2000/svg"')) {
    clean = clean.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!clean.includes("viewBox")) {
    clean = clean.replace("<svg", `<svg viewBox="0 0 ${COVER_VIEWBOX}"`);
  }
  return clean;
}

export interface CoverValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * 合规校验器：参考 svg-architect 的工业级规范，但以纯函数实现。
 * 用于对「AI 生成」的 SVG 做生成后把关，不合规则不采用。
 */
export function validateCoverSvg(svg: string): CoverValidationResult {
  const errors: string[] = [];

  if (!svg || svg.trim().length === 0) {
    return { ok: false, errors: ["SVG 内容为空"] };
  }

  // 根元素为 <svg> 且包含 xmlns
  if (!svg.startsWith("<svg")) {
    errors.push("缺少根 <svg> 元素");
  }
  if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    errors.push("缺少 xmlns 命名空间");
  }

  // viewBox 必须存在且宽高为 900 383（或 1800 766）；viewBox 标准格式为 "min-x min-y width height"
  const vbMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (!vbMatch) {
    errors.push("缺少 viewBox 属性");
  } else {
    const parts = vbMatch[1].trim().replace(/\s+/g, " ").split(" ");
    const widthHeight = parts.slice(-2).join(" ");
    const allowed = [COVER_VIEWBOX, "1800 766"];
    if (!allowed.includes(widthHeight)) {
      errors.push(`viewBox 宽高应为 ${COVER_VIEWBOX}，实际为 ${widthHeight}`);
    }
  }

  // 无障碍：role="img" + <title> + <desc>
  if (!svg.includes('role="img"')) {
    errors.push("根元素缺少 role=\"img\" 无障碍标识");
  }
  if (!/<\s*title[\s>]/i.test(svg)) {
    errors.push("缺少 <title> 无障碍标签");
  }
  if (!/<\s*desc[\s>]/i.test(svg)) {
    errors.push("缺少 <desc> 无障碍描述");
  }

  // 首个非 title/desc 元素应为全画布背景 <rect>
  const bodyStart = svg.indexOf(">");
  if (bodyStart !== -1) {
    let rest = svg.slice(bodyStart + 1).trim();
    // 跳过 <title>... </title> 与 <desc>...</desc>
    rest = rest.replace(/^<\s*title[\s\S]*?<\/\s*title>/i, "").trim();
    rest = rest.replace(/^<\s*desc[\s\S]*?<\/\s*desc>/i, "").trim();
    if (!/^<\s*rect/i.test(rest)) {
      errors.push("首个绘制元素应为全画布背景 <rect>");
    }
  }

  // 违禁标签 / 内容
  const forbidden = [
    { re: /<\s*script/i, name: "<script>" },
    { re: /<\s*foreignObject/i, name: "<foreignObject>" },
    { re: /<\s*iframe/i, name: "<iframe>" },
    { re: /@import/i, name: "@import" },
    { re: /data:\s*image/i, name: "data URI 图片" },
    { re: /<\s*use[^>]*href\s*=\s*["']https?:/i, name: "外部 <use href>" },
  ];
  for (const { re, name } of forbidden) {
    if (re.test(svg)) {
      errors.push(`包含违禁内容：${name}`);
    }
  }

  // 外链 URL（http/https 出现在属性或 url() 中，应保持纯本地渲染；排除 xmlns 命名空间声明）
  const noNs = svg.replace(/xmlns\s*=\s*["'][^"']*["']/g, "");
  if (/(https?:\/\/)/i.test(noNs)) {
    errors.push("包含外链 URL（应保持纯本地渲染）");
  }

  return { ok: errors.length === 0, errors };
}

/**
 * 将 SVG 字符串转换为高清 PNG Blob
 */
export async function svgToPngBlob(
  svgString: string,
  targetWidth = COVER_WIDTH,
  targetHeight = COVER_HEIGHT,
  scale = 2
): Promise<Blob | null> {
  if (!svgString || !svgString.includes("<svg")) return null;

  return new Promise((resolve) => {
    try {
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth * scale;
        canvas.height = targetHeight * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        canvas.toBlob((pngBlob) => {
          resolve(pngBlob);
        }, "image/png");
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * 触发下载公众号封面 PNG 图片
 */
export async function downloadSvgAsPng(
  svgString: string,
  filename = "wechat-cover-900x383.png",
  scale = 2
): Promise<boolean> {
  const blob = await svgToPngBlob(svgString, COVER_WIDTH, COVER_HEIGHT, scale);
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * 一键复制 PNG 图片到系统剪贴板
 */
export async function copySvgAsPngToClipboard(
  svgString: string,
  scale = 2
): Promise<boolean> {
  try {
    const blob = await svgToPngBlob(svgString, COVER_WIDTH, COVER_HEIGHT, scale);
    if (!blob) return false;

    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": blob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}