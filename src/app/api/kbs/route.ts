import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mapKb, type KbRow } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT kb.*, (SELECT COUNT(*) FROM knowledge_items WHERE COALESCE(kb_id, 'default') = kb.id AND chunk_index IS NULL) as notes_count
       FROM knowledge_bases kb
       ORDER BY kb.is_default DESC, kb.created_at ASC`
    )
    .all() as KbRow[];

  return NextResponse.json({ kbs: rows.map(mapKb) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "知识库名称不能为空" }, { status: 400 });
  }

  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO knowledge_bases (id, name, description, is_default) VALUES (?, ?, ?, 0)"
  ).run(id, name, description || null);

  const row = db.prepare("SELECT * FROM knowledge_bases WHERE id = ?").get(id) as KbRow;
  return NextResponse.json({ kb: mapKb(row) }, { status: 201 });
}
