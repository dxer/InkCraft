import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAiConfigured, runTidy, tidyContent } from "@/lib/ai";
import { extractCardFromDoc } from "@/lib/cards";
import { extractClaimsFromDoc } from "@/lib/claims";
import { getDb } from "@/lib/db";
import { mapNote, type KnowledgeRow } from "@/lib/mappers";
import { verifyClipKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-InkCraft-Key",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * 浏览器插件采集入库：接收插件端提取好的正文/选中内容。
 * 鉴权走 X-InkCraft-Key（中间件对本路径放行，此处自行校验）。
 */
export async function POST(request: Request) {
  if (!verifyClipKey(request)) {
    return NextResponse.json(
      { error: "API Key 无效或尚未在设置页生成" },
      { status: 401, headers: CORS }
    );
  }

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json(
      { error: "剪藏内容不能为空" },
      { status: 400, headers: CORS }
    );
  }

  const rawTitle = typeof body?.title === "string" ? body.title.trim() : "";
  const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim().slice(0, 800) : "";
  const mode = body?.mode === "selection" ? "selection" : "page";
  const fallbackTitle = mode === "selection" ? "网页选中摘录" : "网页剪藏";

  // 目标知识库：默认主知识库；指定的库不存在时同样回退
  const db = getDb();
  let kbId = typeof body?.kbId === "string" && body.kbId.trim() ? body.kbId.trim() : "default";
  const kbExists = db.prepare("SELECT 1 FROM knowledge_bases WHERE id = ?").get(kbId);
  if (!kbExists) kbId = "default";

  const id = randomUUID();
  db.prepare(
    "INSERT INTO knowledge_items (id, kb_id, document_id, chunk_index, title, content, item_type, category, source_url) VALUES (?, ?, NULL, NULL, ?, ?, 'note', ?, ?)"
  ).run(id, kbId, rawTitle || fallbackTitle, content, "剪藏", sourceUrl || null);

  // 与手动入库一致：配置了 AI 时异步整理标题与标签，不阻塞返回
  if (isAiConfigured()) {
    runTidy(
      tidyContent(content).then((meta) => {
        if (!meta) return;
        db.prepare(
          "UPDATE knowledge_items SET title = COALESCE(?, title), category = COALESCE(?, category), tags = COALESCE(?, tags), auto_meta = 1 WHERE id = ?"
        ).run(meta.title ?? null, meta.category ?? null, meta.tags ? JSON.stringify(meta.tags) : null, id);
      })
    );
  }
  runTidy(extractClaimsFromDoc(id, content));
  runTidy(extractCardFromDoc(id, content));

  const row = db.prepare("SELECT * FROM knowledge_items WHERE id = ?").get(id) as KnowledgeRow;
  return NextResponse.json(
    { ok: true, note: mapNote(row) },
    { status: 201, headers: CORS }
  );
}
