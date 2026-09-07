import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  generateSessionToken,
  getAccessPassword,
  setAccessPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 登录失败限流：单 IP 15 分钟窗口内最多 8 次失败，防止口令爆破 */
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_FAILS = 8;
const failAtByIp = new Map<string, number[]>();
// ponytail: 单进程内存限流，Docker 单容器场景够用；多副本部署时换成共享计数（Redis/DB）

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function isLoginLocked(ip: string): boolean {
  const now = Date.now();
  const fails = (failAtByIp.get(ip) || []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  failAtByIp.set(ip, fails);
  return fails.length >= RATE_MAX_FAILS;
}

function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const fails = (failAtByIp.get(ip) || []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  fails.push(now);
  failAtByIp.set(ip, fails);
}

function resetLoginFailures(ip: string): void {
  failAtByIp.delete(ip);
}

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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 天有效
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 天有效
  });

  return NextResponse.json({ ok: true });
}
