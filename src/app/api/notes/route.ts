import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAiConfigured, runTidy } from "@/lib/ai";
import { extractCardFromDoc } from "@/lib/cards";
import { clipUrl } from "@/lib/clip";
import { getDb } from "@/lib/db";
import { mapKb, mapNote, type KbRow, type KnowledgeRow } from "@/lib/mappers";
import { parsePdfBuffer } from "@/lib/pdf";
import { ftsSearchNotes, likeSearchNotes } from "@/lib/search";
import { deriveTitleFromContent } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 300;
const SEARCH_LIMIT = 80;

type Db = ReturnType<typeof getDb>;

export async function GET(request: Request) {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  const q = (url.searchParams.get("q") ?? "").trim();
  const kbId = url.searchParams.get("kb_id") ?? "";
  const aiConfigured = isAiConfigured();
  const db = getDb();

  const kbs = db
    .prepare(
      `SELECT kb.*, (SELECT COUNT(*) FROM knowledge_items WHERE COALESCE(kb_id, 'default') = kb.id AND chunk_index IS NULL) as notes_count
       FROM knowledge_bases kb
       ORDER BY kb.is_default DESC, kb.created_at ASC`,
    )
    .all() as KbRow[];

  if (!q) {
    const notes = listNotes(db, kbId);
    return NextResponse.json({
      notes,
      kbs: kbs.map(mapKb),
      currentKb: kbId || "all",
      aiConfigured,
    });
  }

  const searchResults = searchNotes(db, q, kbId);
  return NextResponse.json({
    query: q,
    notes: searchResults,
    kbs: kbs.map(mapKb),
    currentKb: kbId || "all",
    aiConfigured,
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const db = getDb();

  let kbId = "default";
  let title = "";
  let content = "";
  let category = "通用";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file") as File | null;
    kbId = (formData?.get("kb_id") as string)?.trim() || "default";
    category = (formData?.get("category") as string)?.trim() || "通用";

    if (!file) {
      return NextResponse.json({ error: "未选择文件" }, { status: 400 });
    }

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
    kbId =
      typeof body?.kbId === "string" && body.kbId
        ? body.kbId.trim()
        : "default";
    category =
      typeof body?.category === "string" && body.category.trim()
        ? body.category.trim()
        : "通用";
    title = typeof body?.title === "string" ? body.title.trim() : "";
    content = typeof body?.content === "string" ? body.content.trim() : "";

    // 网页剪藏模式
    if (body?.mode === "url" && typeof body?.url === "string") {
      const url = body.url.trim();
      try {
        const clip = await clipUrl(url);
        title = title || clip.title;
        content = clip.content;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "网页抓取失败";
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }
  }

  if (!content.trim()) {
    return NextResponse.json({ error: "笔记内容不能为空" }, { status: 400 });
  }

  // 未填写标题时，截取正文开头作为标题
  if (!title) title = deriveTitleFromContent(content);

  const id = randomUUID();
  db.prepare(
    "INSERT INTO knowledge_items (id, kb_id, document_id, chunk_index, title, content, item_type, category) VALUES (?, ?, NULL, NULL, ?, ?, 'note', ?)",
  ).run(id, kbId, title || null, content, category);

  // 录入后仅异步萃取八项知识卡片；标题/标签/智鉴均不主动运行，由用户手动触发
  runTidy(extractCardFromDoc(id, content));

  const row = db
    .prepare("SELECT * FROM knowledge_items WHERE id = ?")
    .get(id) as KnowledgeRow;
  return NextResponse.json(
    { note: mapNote(row), aiConfigured: isAiConfigured() },
    { status: 201 },
  );
}

function listNotes(db: Db, kbId: string) {
  const where: string[] = ["chunk_index IS NULL"];
  const values: string[] = [];

  if (kbId && kbId !== "all") {
    where.push("COALESCE(kb_id, 'default') = ?");
    values.push(kbId);
  }

  const rows = db
    .prepare(
      `SELECT * FROM knowledge_items WHERE ${where.join(" AND ")} ORDER BY created_at DESC, id LIMIT ${LIST_LIMIT}`,
    )
    .all(...values) as KnowledgeRow[];

  return rows.map(mapNote);
}

function searchNotes(db: Db, q: string, kbId: string) {
  const where: string[] = ["chunk_index IS NULL"];
  const values: string[] = [];
  if (kbId && kbId !== "all") {
    where.push("COALESCE(kb_id, 'default') = ?");
    values.push(kbId);
  }

  const hits =
    ftsSearchNotes(db, q, SEARCH_LIMIT) ?? likeSearchNotes(db, q, SEARCH_LIMIT);
  if (hits.length === 0) return [];

  const idSet = new Set(hits.map((h) => h.id));
  const rows = db
    .prepare(
      `SELECT * FROM knowledge_items WHERE id IN (${[...idSet].map(() => "?").join(",")}) AND ${where.join(" AND ")}`,
    )
    .all(...idSet, ...values) as KnowledgeRow[];

  const snippetById = new Map(hits.map((h) => [h.id, h.snippet]));
  return rows.map((r) => ({
    ...mapNote(r),
    snippet: snippetById.get(r.id) || null,
  }));
}
