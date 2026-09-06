import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, isAuthRequired, verifySessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const authenticated = verifySessionToken(token);

  return NextResponse.json({
    authRequired: isAuthRequired(),
    authenticated,
  });
}
