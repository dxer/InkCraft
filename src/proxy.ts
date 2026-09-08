import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "./lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 放行静态资源、登录页与认证/插件接口。
  // /mcp 走自带的 Bearer API Key 鉴权（api_keys 表），调用方是外部 MCP 客户端、没有浏览器会话，
  // 若被 Cookie 门禁拦截，Bearer Key 校验永远没有机会执行，MCP 功能整体不可用。
  // /api/topics/mine 不再按 Host 头放行（Host 可伪造）：页面按钮同源带 Session Cookie 即可通过；
  // 定时挖掘改由 instrumentation 进程内直接调用 lib，不走 HTTP。
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname === "/login" ||
    pathname === "/mcp" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/extension")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  // 有口令则校验 session token；无口令（未配置）时 verifySessionToken 同样返回 false，
  // 一律要求先到登录页配置，不再直接放行
  const isAuthenticated = verifySessionToken(token);

  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
