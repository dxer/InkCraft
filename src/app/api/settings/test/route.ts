import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const customBaseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
  const customApiKey = typeof body?.apiKey === "string" && !body.apiKey.includes("...") ? body.apiKey.trim() : "";
  const customModel = typeof body?.model === "string" ? body.model.trim() : "";

  const stored = getByok();
  const baseUrl = customBaseUrl || stored?.baseUrl || "";
  const apiKey = customApiKey || stored?.apiKey || "";
  const model = customModel || stored?.model || "";

  if (!baseUrl || !apiKey) {
    return NextResponse.json({
      ok: false,
      error: "请先填写 BaseURL 与 API Key",
    }, { status: 400 });
  }
  if (!model) {
    return NextResponse.json({
      ok: false,
      error: "未配置文本模型：请在提供商下勾选并标注一个「文本」模型",
    }, { status: 400 });
  }

  const start = Date.now();
  try {
    const provider = createOpenAICompatible({
      name: "inkcraft_test",
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    const { text } = await generateText({
      model: provider.chatModel(model),
      prompt: "hi, reply with 'pong'",
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(15_000),
    });

    const latency = Date.now() - start;
    return NextResponse.json({
      ok: true,
      latencyMs: latency,
      reply: text.trim().slice(0, 30),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "连接失败";
    return NextResponse.json({
      ok: false,
      error: msg,
      latencyMs: Date.now() - start,
    }, { status: 502 });
  }
}
