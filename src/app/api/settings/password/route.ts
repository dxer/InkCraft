import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  generateSessionToken,
  getAccessPassword,
  isSecureRequest,
  setAccessPassword,
  verifySessionToken,
} from "@/lib/auth";
import {
  clientIp,
  isLoginLocked,
  recordLoginFailure,
  resetLoginFailures,
} from "@/lib/login-guard";

export const dynamic = "force-dynamic";

/**
 * 修改访问口令（设置页「访问口令与安全」）。
 * 放在 /api/settings 下由代理层会话门禁保护（/api/auth/* 是公开通道，不适合放本接口）。
 * 口令派生会话 Token：改口令即全端下线，当前设备补发新会话免重登。
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  // 纵深防御：代理层已拦过一次，此处仍校验会话
  if (!verifySessionToken(cookieStore.get(COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // env 口令优先级高于 DB，这里改了也不会生效，明确拒绝避免「改了却没生效」的错觉
  if (process.env.ACCESS_PASSWORD?.trim()) {
    return NextResponse.json(
      { error: "访问口令由环境变量 ACCESS_PASSWORD 配置，请在部署配置中修改" },
      { status: 400 },
    );
  }

  const requiredPassword = getAccessPassword();
  if (!requiredPassword) {
    return NextResponse.json({ error: "尚未设置访问口令" }, { status: 400 });
  }

  const ip = clientIp(request);
  if (isLoginLocked(ip)) {
    return NextResponse.json(
      { error: "尝试过于频繁，请 15 分钟后再试" },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const currentPassword =
    typeof body?.currentPassword === "string" ? body.currentPassword.trim() : "";
  const newPassword =
    typeof body?.newPassword === "string" ? body.newPassword.trim() : "";

  if (currentPassword !== requiredPassword) {
    recordLoginFailure(ip);
    return NextResponse.json({ error: "当前口令错误" }, { status: 401 });
  }
  if (newPassword.length < 4) {
    return NextResponse.json({ error: "新口令至少 4 位" }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "新口令不能与当前口令相同" }, { status: 400 });
  }

  setAccessPassword(newPassword);
  resetLoginFailures(ip);

  const token = generateSessionToken(newPassword);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true });
}
