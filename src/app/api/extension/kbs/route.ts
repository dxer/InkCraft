import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyClipKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-InkCraft-Key",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** 插件「知识库列表」：供剪藏弹窗选择保存目标。走 X-InkCraft-Key 鉴权。 */
export async function GET(request: Request) {
  if (!verifyClipKey(request)) {
    return NextResponse.json(
      { error: "API Key 无效或尚未在设置页生成" },
      { status: 401, headers: CORS }
    );
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT kb.id, kb.name, kb.is_default
       FROM knowledge_bases kb
       ORDER BY kb.is_default DESC, kb.created_at ASC`
    )
    .all() as { id: string; name: string; is_default: number }[];

  return NextResponse.json(
    {
      kbs: rows.map((r) => ({
        id: r.id,
        name: r.name,
        isDefault: !!r.is_default,
      })),
    },
    { headers: CORS }
  );
}