import { NextResponse } from "next/server";
import { checkAndMineHourlyTopics } from "@/lib/topics";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;

  try {
    const result = await checkAndMineHourlyTopics({ force });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "增量选题分析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
