import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mapNote, type KnowledgeRow } from "@/lib/mappers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare("SELECT * FROM knowledge_items WHERE id = ?").get(id) as KnowledgeRow | undefined;
  if (!row) {
    return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
  }
  return NextResponse.json({ note: mapNote(row) });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  if (typeof body.title === "string") {
    sets.push("title = ?", "auto_meta = 0");
    values.push(body.title.trim() || null);
  }
  if (typeof body.content === "string") {
    sets.push("content = ?");
    values.push(body.content.trim());
  }
  if (typeof body.category === "string" && body.category.trim()) {
    sets.push("category = ?");
    values.push(body.category.trim());
  }
  if (Array.isArray(body.tags)) {
    sets.push("tags = ?");
    values.push(JSON.stringify(body.tags.filter((t: unknown) => typeof t === "string")));
  }
  if (typeof body.kbId === "string" && body.kbId.trim()) {
    sets.push("kb_id = ?");
    values.push(body.kbId.trim());
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  // 任何字段变更都视为一次修改，刷新修改时间
  sets.push("updated_at = CURRENT_TIMESTAMP");

  const db = getDb();
  const result = db
    .prepare(`UPDATE knowledge_items SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values, id);

  if (result.changes === 0) {
    return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
  }

  const row = db.prepare("SELECT * FROM knowledge_items WHERE id = ?").get(id) as KnowledgeRow;
  return NextResponse.json({ note: mapNote(row) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const result = db.prepare("DELETE FROM knowledge_items WHERE id = ?").run(id);
  if (result.changes === 0) {
    return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
  }
  // 智鉴记录由 note_insights_cleanup 触发器在删除时级联清理，此处无需手动处理
  return NextResponse.json({ ok: true });
}
