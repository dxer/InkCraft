import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mapDocument, type DocumentRow } from "@/lib/mappers";
import type { ChunkItem } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocumentRow | undefined;
  if (!doc) {
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  }
  const chunks = db
    .prepare("SELECT id, chunk_index, content FROM knowledge_items WHERE document_id = ? ORDER BY chunk_index")
    .all(id) as ChunkItem[];
  return NextResponse.json({
    document: mapDocument(doc),
    chunks,
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  // 切片经 FK ON DELETE CASCADE 级联删除，FTS 由触发器清理
  const result = getDb().prepare("DELETE FROM documents WHERE id = ?").run(id);
  if (result.changes === 0) {
    return NextResponse.json({ error: "文档不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
