import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mapKb, type KbRow } from "@/lib/mappers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  if (typeof body.name === "string" && body.name.trim()) {
    sets.push("name = ?");
    values.push(body.name.trim());
  }
  if (body.description !== undefined) {
    sets.push("description = ?");
    values.push(typeof body.description === "string" ? body.description.trim() || null : null);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
  }

  const db = getDb();
  const res = db.prepare(`UPDATE knowledge_bases SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);

  if (res.changes === 0) {
    return NextResponse.json({ error: "知识库不存在" }, { status: 404 });
  }

  const row = db.prepare("SELECT * FROM knowledge_bases WHERE id = ?").get(id) as KbRow;
  return NextResponse.json({ kb: mapKb(row) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  if (id === "default") {
    return NextResponse.json({ error: "默认知识库不可删除" }, { status: 400 });
  }

  const db = getDb();
  // 事务中将该知识库下的内容（笔记与切片、历史文档）平滑迁移回默认知识库
  const deleteTx = db.transaction((targetId: string) => {
    db.prepare("UPDATE knowledge_items SET kb_id = 'default' WHERE kb_id = ?").run(targetId);
    db.prepare("UPDATE documents SET kb_id = 'default' WHERE kb_id = ?").run(targetId);
    return db.prepare("DELETE FROM knowledge_bases WHERE id = ?").run(targetId);
  });

  const res = deleteTx(id);

  if (res.changes === 0) {
    return NextResponse.json({ error: "知识库不存在" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
