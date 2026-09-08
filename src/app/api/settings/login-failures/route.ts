import { NextResponse } from "next/server";
import { listRecentLoginFailures } from "@/lib/login-guard";

export const dynamic = "force-dynamic";

/** 最近登录失败记录（代理层会话门禁保护），供设置页安全面板展示 */
export async function GET() {
  return NextResponse.json({ failures: listRecentLoginFailures(10) });
}
