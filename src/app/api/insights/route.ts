import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { isZhijianDimension, runZhijian, type ZhijianDimension } from "@/lib/zhijian";

export const dynamic = "force-dynamic";

/** 全文分析时的正文截断上限（防止超长笔记撑爆上下文） */
const NOTE_TEXT_LIMIT = 6000;

interface InsightRow {
  id: string;
  note_id: string;
  dimension: string;
  content: string;
  is_mock: number;
  created_at: string;
}

function mapInsight(row: InsightRow) {
  return {
    id: row.id,
    noteId: row.note_id,
    dimension: row.dimension as ZhijianDimension,
    content: row.content,
    isMock: !!row.is_mock,
    createdAt: row.created_at,
  };
}

/** 某篇笔记的智鉴记录列表（新→旧） */
export async function GET(request: Request) {
  const noteId = new URL(request.url).searchParams.get("noteId")?.trim();
  if (!noteId) {
    return NextResponse.json({ error: "缺少 noteId" }, { status: 400 });
  }

  const rows = getDb()
    .prepare(
      "SELECT * FROM note_insights WHERE note_id = ? ORDER BY created_at DESC, id DESC LIMIT 100"
    )
    .all(noteId) as InsightRow[];

  return NextResponse.json({ insights: rows.map(mapInsight) });
}

/** 对整篇笔记跑一个智鉴维度并落库 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const noteId = typeof body?.noteId === "string" ? body.noteId.trim() : "";
  const dimension = typeof body?.dimension === "string" ? body.dimension : "";

  if (!noteId || !isZhijianDimension(dimension)) {
    return NextResponse.json({ error: "缺少 noteId 或维度不合法" }, { status: 400 });
  }

  const db = getDb();
  const note = db
    .prepare("SELECT title, content FROM knowledge_items WHERE id = ?")
    .get(noteId) as { title: string | null; content: string } | undefined;
  if (!note) {
    return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
  }
  if (!note.content.trim()) {
    return NextResponse.json({ error: "笔记内容为空，无法分析" }, { status: 400 });
  }

  const text = note.content.slice(0, NOTE_TEXT_LIMIT);
  const context = note.title ? `笔记标题：${note.title}` : "";

  try {
    const { content, isMock } = await runZhijian(dimension, text, context);

    const id = randomUUID();
    db.prepare(
      "INSERT INTO note_insights (id, note_id, dimension, content, is_mock) VALUES (?, ?, ?, ?, ?)"
    ).run(id, noteId, dimension, content, isMock ? 1 : 0);

    const row = db.prepare("SELECT * FROM note_insights WHERE id = ?").get(id) as InsightRow;
    return NextResponse.json({ insight: mapInsight(row) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI 调用失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
