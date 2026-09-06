import { NextResponse } from "next/server";
import { deleteMinedInsight, updateMinedInsight } from "@/lib/claims";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.status && ["unread", "starred", "used"].includes(body.status)) {
      updateMinedInsight(id, { status: body.status });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "无效的状态值" }, { status: 400 });
  } catch (error) {
    console.error("[api/insights/mined/[id]] PATCH", error);
    return NextResponse.json({ error: "更新洞察状态失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    deleteMinedInsight(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/insights/mined/[id]] DELETE", error);
    return NextResponse.json({ error: "删除洞察失败" }, { status: 500 });
  }
}
