import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, generateSessionToken } from "./lib/auth";

export function proxy(request: NextRequest) {
  const password = process.env.ACCESS_PASSWORD?.trim();
  // 未设置密码门禁时全量放行
  if (!password) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // 放行静态资源、登录页、认证接口及本地周期增量挖掘任务
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/extension") ||
    (pathname === "/api/topics/mine" && (request.headers.get("host")?.startsWith("localhost") || request.headers.get("host")?.startsWith("127.0.0.1")))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const expectedToken = generateSessionToken(password);
  const authHeader = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isAuthenticated = token === expectedToken || authHeader === password;

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
