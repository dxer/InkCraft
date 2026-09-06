import { NextResponse } from "next/server";
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

/** 插件「测试连接」：校验服务地址与 API Key 是否匹配 */
export async function GET(request: Request) {
  if (!verifyClipKey(request)) {
    return NextResponse.json(
      { ok: false, error: "API Key 无效或尚未在设置页生成" },
      { status: 401, headers: CORS }
    );
  }
  return NextResponse.json(
    { ok: true, name: "墨匠 InkCraft" },
    { headers: CORS }
  );
}
