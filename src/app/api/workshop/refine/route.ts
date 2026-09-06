import { NextResponse } from "next/server";
import { isZhijianDimension, runZhijian } from "@/lib/zhijian";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const action = body?.action as string;
  const selectedText = typeof body?.selectedText === "string" ? body.selectedText.trim() : "";
  const context = typeof body?.context === "string" ? body.context.slice(0, 1500) : "";

  if (!selectedText) {
    return NextResponse.json({ error: "选中文字不能为空" }, { status: 400 });
  }

  if (!isZhijianDimension(action)) {
    return NextResponse.json({ error: "不支持的智鉴维度" }, { status: 400 });
  }

  try {
    const { content, isMock } = await runZhijian(action, selectedText, context);
    return NextResponse.json({ result: content, isMock });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI 调用失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
