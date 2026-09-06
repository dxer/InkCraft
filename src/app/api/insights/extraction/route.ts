import { NextResponse } from "next/server";
import { getSproutResult } from "@/lib/sprout";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId");
    if (!noteId) {
      return NextResponse.json({ error: "缺少 noteId" }, { status: 400 });
    }

    const sprout = getSproutResult(noteId);
    return NextResponse.json({ sprout, extraction: sprout });
  } catch (error) {
    console.error("[api/insights/extraction]", error);
    return NextResponse.json({ error: "获取智鉴发芽档案失败" }, { status: 500 });
  }
}
