import { NextResponse } from "next/server";
import { runSproutForDoc } from "@/lib/sprout";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { docId, content } = await request.json();
    if (!docId) {
      return NextResponse.json({ error: "缺少 docId" }, { status: 400 });
    }

    let textContent = content;
    if (!textContent) {
      const db = getDb();
      const item = db
        .prepare("SELECT content FROM knowledge_items WHERE id = ?")
        .get(docId) as { content: string } | undefined;
      textContent = item?.content;
    }

    if (!textContent) {
      return NextResponse.json({ error: "未找到文档正文" }, { status: 404 });
    }

    const sprout = await runSproutForDoc(docId, textContent);
    return NextResponse.json({ ok: true, sprout, extraction: sprout });
  } catch (error) {
    console.error("[api/insights/extract]", error);
    return NextResponse.json({ error: "智鉴知识发芽失败" }, { status: 500 });
  }
}
