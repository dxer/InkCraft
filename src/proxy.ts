import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, generateSessionToken } from "./lib/auth";

export function proxy(request: NextRequest) {
  const password = process.env.ACCESS_PASSWORD?.trim();
  // 未设置密码门禁时全量放行
  if (!password) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // 放行静态资源、登录页与认证/插件接口。
  // /api/topics/mine 不再按 Host 头放行（Host 可伪造）：页面按钮同源带 Session Cookie 即可通过；
  // 定时挖掘改由 instrumentation 进程内直接调用 lib，不走 HTTP。
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/extension")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const expectedToken = generateSessionToken(password);
  // 只认 Session Cookie；不接受 Authorization 携带原始口令（会落访问日志且绕过登录限流）
  const isAuthenticated = token === expectedToken;

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
