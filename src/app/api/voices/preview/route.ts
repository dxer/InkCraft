import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** 试听题目刻意选中性的方法论主题，让文风差异成为唯一变量 */
const DEMO_SUBJECT = "把一件小事做到极致";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const voiceId = typeof body?.voiceId === "string" ? body.voiceId : "";

  const db = getDb();
  const voice = db
    .prepare("SELECT id, name, rules_prompt FROM voice_profiles WHERE id = ?")
    .get(voiceId) as { id: string; name: string; rules_prompt: string | null } | undefined;

  if (!voice) {
    return NextResponse.json({ error: "声库档案不存在" }, { status: 404 });
  }

  const cfg = getByok();
  if (!cfg) {
    return NextResponse.json({
      sample:
        "工具的脾气，就是匠人的脾气。\n\n当一件小事被反复打磨上千次，它便不再是小事，而成为方法本身。极致从不喧哗，它只是把每一次重复，都比上一次收紧一分——直到分寸成为本能。",
      mock: true,
    });
  }

  try {
    const provider = createOpenAICompatible({
      name: "inkcraft",
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });
    const { text } = await generateText({
      model: provider.chatModel(cfg.model),
      system: `你是文风克隆演示引擎。下方的《文风约束提示词》描述了一位创作者的行文特征。请严格遵循这套文风，以「${DEMO_SUBJECT}」为题写一段 120 字左右的短文样张。只输出正文，不要标题、解释或元信息。`,
      prompt: `【文风约束提示词】：\n${voice.rules_prompt || "（未抽取到约束，按通用深度出版专栏风执行）"}`,
      temperature: 0.7,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(60_000),
    });
    return NextResponse.json({ sample: text.trim(), mock: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "生成失败，请检查 BYOK 端点" },
      { status: 502 }
    );
  }
}
