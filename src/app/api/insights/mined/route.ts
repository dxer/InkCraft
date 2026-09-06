import { NextResponse } from "next/server";
import { getMinedInsights } from "@/lib/claims";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const insights = getMinedInsights(status);
    return NextResponse.json({ insights });
  } catch (error) {
    console.error("[api/insights/mined]", error);
    return NextResponse.json({ error: "获取洞察列表失败" }, { status: 500 });
  }
}
