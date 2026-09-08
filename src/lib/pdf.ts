// 补齐 Node.js 服务端缺少浏览器 DOMMatrix 全局对象的兼容层（避免 pdfjs-dist 评估报错）
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

export async function parsePdfBuffer(buffer: Buffer): Promise<{ title: string; content: string }> {
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
