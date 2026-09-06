import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** 删除一张知识卡片（萃取产物，可随时重新萃取；不影响源笔记） */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const result = db.prepare("DELETE FROM knowledge_cards WHERE id = ?").run(id);
  if (result.changes === 0) {
    return NextResponse.json({ error: "卡片不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
