// 补齐 Node.js 服务端缺少浏览器 DOMMatrix / ImageData / Path2D 全局对象的兼容层（避免 pdfjs-dist / pdf-parse 报错）
function ensurePdfBrowserPolyfills() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    class DOMMatrixPolyfill {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true;
      isIdentity = true;
      constructor(init?: unknown) {
        if (Array.isArray(init) && init.length >= 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
          this.m11 = this.a; this.m12 = this.b;
          this.m21 = this.c; this.m22 = this.d;
          this.m41 = this.e; this.m42 = this.f;
        }
      }
    }
    // @ts-expect-error polyfill for Node.js runtime PDF parsing
    globalThis.DOMMatrix = DOMMatrixPolyfill;
  }

  if (typeof globalThis.ImageData === "undefined") {
    class ImageDataPolyfill {
      width: number;
      height: number;
      data: Uint8ClampedArray;
      constructor(w = 0, h = 0) {
        this.width = w;
        this.height = h;
        this.data = new Uint8ClampedArray(w * h * 4);
      }
    }
    // @ts-expect-error polyfill for Node.js runtime PDF parsing
    globalThis.ImageData = ImageDataPolyfill;
  }

  if (typeof globalThis.Path2D === "undefined") {
    class Path2DPolyfill {}
    // @ts-expect-error polyfill for Node.js runtime PDF parsing
    globalThis.Path2D = Path2DPolyfill;
  }
}

export async function parsePdfBuffer(buffer: Buffer): Promise<{ title: string; content: string }> {
  ensurePdfBrowserPolyfills();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const textData = await parser.getText();
    const text = (textData?.text || "").replace(/\r\n?/g, "\n").trim();
    let title = "";
    try {
      const info = await parser.getInfo();
      title = (info?.info?.Title as string) || "";
    } catch {}

    return {
      title,
      content: text,
    };
  } finally {
    await parser.destroy().catch(() => {});
  }
}
