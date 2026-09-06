import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getClipKey, setSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** 供设置页读取当前采集 API Key（受登录会话保护，不走 /api/extension 免鉴权通道） */
export async function GET() {
  return NextResponse.json({ key: getClipKey() });
}

/** 生成新的 API Key；旧 Key 立即失效 */
export async function POST() {
  const key = `ick_${randomBytes(24).toString("hex")}`;
  setSetting("api.clip_key", key);
  return NextResponse.json({ key }, { status: 201 });
}
