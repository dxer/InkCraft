import { NextResponse } from "next/server";
import { deleteApiKey, revokeApiKey } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    if (!id) {
      return NextResponse.json({ error: "缺少密钥 ID" }, { status: 400 });
    }

    const deleted = deleteApiKey(id);
    if (!deleted) {
      return NextResponse.json({ error: "密钥不存在或已删除" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API_KEYS] Delete key error:", error);
    return NextResponse.json({ error: "删除密钥失败" }, { status: 500 });
  }
}

export async function PATCH(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    if (!id) {
      return NextResponse.json({ error: "缺少密钥 ID" }, { status: 400 });
    }

    const revoked = revokeApiKey(id);
    return NextResponse.json({ success: revoked });
  } catch (error) {
    console.error("[API_KEYS] Revoke key error:", error);
    return NextResponse.json({ error: "撤销密钥失败" }, { status: 500 });
  }
}
