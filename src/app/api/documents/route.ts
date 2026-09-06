import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAiConfigured, runTidy, tidyContent } from "@/lib/ai";
import { extractCardFromDoc } from "@/lib/cards";
import { chunkText } from "@/lib/chunk";
import { clipUrl } from "@/lib/clip";
import { getDb } from "@/lib/db";
import { mapDocument, type DocumentRow } from "@/lib/mappers";
import { parsePdfBuffer } from "@/lib/pdf";

export const dynamic = "force-dynamic";

/**
 * 长文入库：
 * 1. JSON 请求：paste（粘贴正文）/ url（网页剪藏）
 * 2. FormData 请求：直接上传 .pdf / .md / .txt 文件
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  let title = "";
  let content = "";
  let sourceUrl: string | null = null;
  let sourceType: "paste" | "upload" | "web" = "paste";
  let fileName: string | null = null;
  let mimeType: string | null = null;
  let category = "通用";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file") as File | null;
    category = (formData?.get("category") as string)?.trim() || "通用";

    if (!file) {
      return NextResponse.json({ error: "未选择文件" }, { status: 400 });
    }

    fileName = file.name;
    sourceType = "upload";
    mimeType = file.type || "text/plain";
    title = file.name.replace(/\.[^.]+$/, "");

    if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parsed = await parsePdfBuffer(buffer);
        title = parsed.title || title;
        content = parsed.content;
      } catch {
        return NextResponse.json({ error: "PDF 解析失败" }, { status: 422 });
      }
    } else {
      content = await file.text();
    }
  } else {
    const body = await request.json().catch(() => null);
    const mode = body?.mode === "url" ? "url" : "paste";
    category = typeof body?.category === "string" && body.category.trim() ? body.category.trim() : "通用";
    title = typeof body?.title === "string" ? body.title.trim() : "";
    content = typeof body?.content === "string" ? body.content.trim() : "";

    if (mode === "url") {
      sourceType = "web";
      const url = typeof body?.url === "string" ? body.url.trim() : "";
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return NextResponse.json({ error: "链接格式不正确" }, { status: 400 });
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json({ error: "仅支持 http/https 链接" }, { status: 400 });
      }
      try {
        const clip = await clipUrl(url);
        title = title || clip.title;
        content = clip.content;
        sourceUrl = url;
      } catch (err) {
        const message = err instanceof Error ? err.message : "抓取失败";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }
  }

  if (!content.trim()) {
    return NextResponse.json({ error: "正文内容不能为空" }, { status: 400 });
  }
  if (!title) title = `导入文档 · ${new Date().toLocaleDateString("zh-CN")}`;

  const db = getDb();
  const id = randomUUID();
  const chunks = chunkText(content);

  const insertDoc = db.prepare(
    "INSERT INTO documents (id, title, source_type, source_url, file_name, mime_type, category, status, chunk_count, raw_content) VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)"
  );
  const insertChunk = db.prepare(
    "INSERT INTO knowledge_items (id, document_id, chunk_index, title, content, item_type, category) VALUES (?, ?, ?, ?, ?, 'chunk', ?)"
  );

  const transaction = db.transaction(() => {
    insertDoc.run(id, title, sourceType, sourceUrl, fileName, mimeType, category, chunks.length, content);
    chunks.forEach((chunk, i) => {
      insertChunk.run(randomUUID(), id, i, `${title} · 切片 ${i + 1}`, chunk, category);
    });
  });
  transaction();

  if (isAiConfigured()) {
    runTidy(
      tidyContent(content).then((meta) => {
        if (!meta) return;
        db.prepare("UPDATE documents SET category = COALESCE(?, category), tags = COALESCE(?, tags) WHERE id = ?").run(
          meta.category ?? null,
          meta.tags ? JSON.stringify(meta.tags) : null,
          id
        );
      })
    );
  }

  // 长文档入库后，对全文做一次八项知识卡片萃取（绑定父文档 id）
  if (content.trim().length >= 20) {
    runTidy(extractCardFromDoc(id, content));
  }

  const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocumentRow;
  return NextResponse.json(
    { document: mapDocument(row), aiConfigured: isAiConfigured() },
    { status: 201 }
  );
}
