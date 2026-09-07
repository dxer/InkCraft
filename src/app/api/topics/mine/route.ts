import { NextResponse } from "next/server";
import { runTopicRadarMining } from "@/lib/topic-radar";
import { checkAndMineHourlyTopics } from "@/lib/topics";
import type { TopicRadarAngleType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;
  const useRadar = body?.radar !== false; // 默认采用智能选题雷达引擎
  const angleType = (body?.angleType || "all") as TopicRadarAngleType | "all";
  const count = typeof body?.count === "number" ? body.count : 3;

  try {
    if (useRadar) {
      const result = await runTopicRadarMining({ angleType, count });
      return NextResponse.json(result);
    }
    const result = await checkAndMineHourlyTopics({ force });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "选题雷达分析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
