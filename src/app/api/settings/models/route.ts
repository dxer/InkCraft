import { NextResponse } from "next/server";
import { getProviders } from "@/lib/settings";

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT = 8_000;

/**
 * 拉取某 OpenAI 兼容端点的可用模型列表（GET {baseUrl}/models）。
 * 用于设置页「勾选模型」功能；无 /models 接口的端点会报错，由前端提示并回退手填。
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const baseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";

  // 优先用已存配置里的真实 key；否则用前端新填的 key
  const stored = typeof body?.providerId === "string"
    ? getProviders().find((p) => p.id === body.providerId)
    : undefined;
  let apiKey = stored?.apiKey || "";
  const inlineKey = typeof body?.apiKey === "string" && body.apiKey.trim() && !body.apiKey.includes("...")
    ? body.apiKey.trim()
    : "";
  if (inlineKey) apiKey = inlineKey;

  if (!baseUrl) {
    return NextResponse.json({ error: "请先填写 API BaseURL" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "请先填写 API Key" }, { status: 400 });
  }

  // 未传有效 key（如掩码回传）时落在设置层已有 key；拿不到只能让用户手填
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/models`;

  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = (await res.text().catch(() => "")).slice(0, 120);
      return NextResponse.json(
        { error: `拉取失败（HTTP ${res.status}）：${errText || res.statusText}` },
        { status: 502 }
      );
    }
    const data = await res.json().catch(() => null);
    const ids = Array.isArray(data?.data)
      ? data.data
          .map((m: { id?: unknown }) => (typeof m?.id === "string" ? m.id.trim() : ""))
          .filter(Boolean)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "该端点没有返回任何模型" }, { status: 422 });
    }
    return NextResponse.json({ models: ids });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "网络连接失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}