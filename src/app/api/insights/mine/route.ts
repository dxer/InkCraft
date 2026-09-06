import { NextResponse } from "next/server";
import { mineInsights } from "@/lib/claims";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const kbId = typeof body?.kbId === "string" ? body.kbId : undefined;
    const insights = await mineInsights({ kbId });
    return NextResponse.json({ insights, count: insights.length });
  } catch (error) {
    console.error("[api/insights/mine]", error);
    return NextResponse.json({ error: "全库淘金失败" }, { status: 500 });
  }
}
