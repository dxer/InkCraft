import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { extractCardFromDoc, getAllCards, getCardsForDoc, getCardStats } from "@/lib/cards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const docId = searchParams.get("doc_id") || searchParams.get("document_id");

  if (docId) {
    const cards = getCardsForDoc(docId);
    return NextResponse.json({ cards });
  }

  const cards = getAllCards();
  const stats = getCardStats();
  return NextResponse.json({ cards, stats });
}

/**
 * 手动补萃卡片：
 * - body { docIds: string[] }：对指定旧笔记逐篇生成/刷新卡片
 * - body { all: true }：全库重新入卡（对前 60 条无卡/全部笔记逐篇萃取）
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const docIds = Array.isArray(body?.docIds) ? body.docIds.map(String).filter(Boolean) : [];
  const reextractAll = body?.all === true;

  let targets: { id: string; content: string }[] = [];
  const db = getDb();

  if (reextractAll) {
    targets = db
      .prepare("SELECT id, content FROM knowledge_items WHERE chunk_index IS NULL ORDER BY updated_at DESC LIMIT 60")
      .all() as { id: string; content: string }[];
  } else if (docIds.length > 0) {
    targets = [];
    for (const docId of docIds) {
      const row = db.prepare("SELECT id, content FROM knowledge_items WHERE id = ? AND chunk_index IS NULL").get(docId) as
        | { id: string; content: string }
        | undefined;
      if (row) targets.push(row);
    }
  } else {
    return NextResponse.json({ error: "请指定 docIds 或 all: true" }, { status: 400 });
  }

  let succeeded = 0;
  for (const t of targets) {
    try {
      const card = await extractCardFromDoc(t.id, t.content);
      if (card) succeeded++;
    } catch {
      // 单篇失败不影响整体
    }
  }

  return NextResponse.json({ ok: succeeded > 0, reextracted: succeeded, total: targets.length });
}