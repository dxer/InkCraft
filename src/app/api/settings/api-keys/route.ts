import { NextResponse } from "next/server";
import { generateApiKey, listApiKeys } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const keys = listApiKeys();
    return NextResponse.json({ success: true, keys });
  } catch (error) {
    console.error("[API_KEYS] List keys error:", error);
    return NextResponse.json(
      { error: "获取密钥列表失败" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    const created = generateApiKey(name || "外部 Agent 密钥");
    return NextResponse.json({
      success: true,
      key: created,
      warning: "密钥仅在此处完整展示一次，请立即复制并妥善保存",
    });
  } catch (error) {
    console.error("[API_KEYS] Create key error:", error);
    return NextResponse.json(
      { error: "创建密钥失败" },
      { status: 500 },
    );
  }
}
