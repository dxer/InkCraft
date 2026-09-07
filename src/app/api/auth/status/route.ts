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
    authenticated,
  });
}
