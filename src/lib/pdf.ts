import { PDFParse } from "pdf-parse";

export async function parsePdfBuffer(buffer: Buffer): Promise<{ title: string; content: string }> {
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
