import { NextResponse } from "next/server";
import {
  getTopicStats,
  getTopicsFromDb,
  saveTopicToRepository,
  triggerHourlyMiningAsync,
  type TopicFilterOptions,
} from "@/lib/topics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") || "all") as TopicFilterOptions["status"];
  const targetSkill = searchParams.get("targetSkill") || "all";
  const angleType = searchParams.get("angleType") || "all";
  const search = searchParams.get("search") || "";
  const sourceType = (searchParams.get("sourceType") || "all") as TopicFilterOptions["sourceType"];
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
  const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined;

  const topics = getTopicsFromDb({
    status,
    targetSkill,
    angleType,
    search,
    sourceType,
    limit,
    offset,
  });

  const stats = getTopicStats();

  // 静默懒检查：如果离上次扫描已超过 1 小时且当前未在运行，触发异步分析
  if (stats.lastScannedAt) {
    const elapsed = Date.now() - new Date(stats.lastScannedAt).getTime();
    if (elapsed >= 60 * 60 * 1000 && !stats.miningState?.isMining) {
      triggerHourlyMiningAsync({ force: false });
    }
  }

  return NextResponse.json({
    topics,
    stats,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "无效请求数据" }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "选题标题不能为空" }, { status: 400 });
  }

  try {
    const { topic, created } = saveTopicToRepository({
      title,
      angle: String(body.angle || "").trim(),
      hook: String(body.hook || "").trim(),
      targetSkill: body.targetSkill || "wechat",
      outline: Array.isArray(body.outline) ? body.outline.map(String) : [],
      matchedCards: Array.isArray(body.matchedCards) ? body.matchedCards : [],
      sourceType: body.sourceType || "manual",
      status: body.status || "idea",
    });

    return NextResponse.json({ topic, created }, { status: created ? 201 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存选题失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
