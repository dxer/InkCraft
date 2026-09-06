import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, generateSessionToken, getAccessPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password.trim() : "";

  const requiredPassword = getAccessPassword();
  if (!requiredPassword) {
    return NextResponse.json({ ok: true, message: "未启用密码门禁" });
  }

  if (password !== requiredPassword) {
    return NextResponse.json({ error: "门禁密码错误" }, { status: 401 });
  }

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
