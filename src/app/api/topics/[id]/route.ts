import { NextResponse } from "next/server";
import { deleteTopicFromDb, updateTopicStatusInDb } from "@/lib/topics";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "无效请求数据" }, { status: 400 });
  }

  const status = body.status;
  if (status && !["idea", "used", "archived"].includes(status)) {
    return NextResponse.json({ error: "无效的状态值" }, { status: 400 });
  }

  const success = updateTopicStatusInDb(id, status);
  if (!success) {
    return NextResponse.json({ error: "选题不存在或更新失败" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id, status });
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const success = deleteTopicFromDb(id);
  if (!success) {
    return NextResponse.json({ error: "选题不存在或删除失败" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id });
}
