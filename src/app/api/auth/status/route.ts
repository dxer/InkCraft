import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  isAuthConfigured,
  isAuthRequired,
  verifySessionToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const authenticated = verifySessionToken(token);

  return NextResponse.json({
    authRequired: isAuthRequired(),
    /** 是否已配置访问口令（env 或 DB）；false 表示首启，登录页应引导「设置口令」 */
    configured: isAuthConfigured(),
    /** 口令是否来自环境变量 ACCESS_PASSWORD（true 时网页端改口令不生效，设置页据此提示） */
    passwordFromEnv: !!process.env.ACCESS_PASSWORD?.trim(),
    authenticated,
  });
}
