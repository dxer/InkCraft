import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  generateSessionToken,
  getAccessPassword,
  isSecureRequest,
  setAccessPassword,
} from "@/lib/auth";
import {
  clientIp,
  isLoginLocked,
  recordLoginFailure,
  resetLoginFailures,
} from "@/lib/login-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password =
    typeof body?.password === "string" ? body.password.trim() : "";
  const ip = clientIp(request);

  if (isLoginLocked(ip)) {
    return NextResponse.json(
      { error: "尝试过于频繁，请 15 分钟后再试" },
      { status: 429 },
    );
  }

  const requiredPassword = getAccessPassword();

  // 未配置口令：首次设置模式。校验强度后落库并直接生成会话。
  if (!requiredPassword) {
    if (password.length < 4) {
      return NextResponse.json({ error: "访问口令至少 4 位" }, { status: 400 });
    }
    setAccessPassword(password);
    resetLoginFailures(ip);
    const token = generateSessionToken(password);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecureRequest(request),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return NextResponse.json({ ok: true, firstRun: true });
  }

  if (password !== requiredPassword) {
    recordLoginFailure(ip);
    return NextResponse.json({ error: "门禁密码错误" }, { status: 401 });
  }

  resetLoginFailures(ip);

  const token = generateSessionToken(requiredPassword);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true });
}
