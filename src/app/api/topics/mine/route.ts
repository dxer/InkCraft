import { NextResponse } from "next/server";
import {
  runTopicRadarMining,
  triggerTopicRadarMiningAsync,
} from "@/lib/topic-radar";
import {
  checkAndMineHourlyTopics,
  getTopicMiningState,
  triggerHourlyMiningAsync,
} from "@/lib/topics";
import type { TopicRadarAngleType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 查询选题雷达/挖掘后台任务状态
 */
export async function GET() {
  const state = getTopicMiningState();
  return NextResponse.json({
    isMining: state.isMining,
    status: state.status,
    startedAt: state.startedAt,
    lastScannedAt: state.lastScannedAt,
    lastResult: state.lastResult,
  });
}

/**
 * 触发选题雷达/挖掘任务（默认异步后台执行，防页面跳转丢失与重复点击）
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;
  const useRadar = body?.radar !== false; // 默认采用智能选题雷达引擎
  const angleType = (body?.angleType || "all") as TopicRadarAngleType | "all";
  const count = typeof body?.count === "number" ? body.count : 3;
  const sync = body?.sync === true; // 是否同步等待结果（主要用于测试）

  try {
    // 同步执行模式
    if (sync) {
      if (useRadar) {
        const result = await runTopicRadarMining({ angleType, count });
        return NextResponse.json(result);
      }
      const result = await checkAndMineHourlyTopics({ force });
      return NextResponse.json(result);
    }

    // 默认异步后台执行模式（立即返回，服务端后台运行）
    if (useRadar) {
      const { started, message, state } = triggerTopicRadarMiningAsync({
        angleType,
        count,
      });
      if (!started) {
        return NextResponse.json(
          { error: message, running: true, state },
          { status: 409 },
        );
      }
      return NextResponse.json({
        accepted: true,
        message,
        state,
      });
    }

    const { started, message, state } = triggerHourlyMiningAsync({ force });
    if (!started) {
      return NextResponse.json(
        { error: message, running: true, state },
        { status: 409 },
      );
    }
    return NextResponse.json({
      accepted: true,
      message,
      state,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "选题雷达分析启动失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
