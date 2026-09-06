import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare("SELECT * FROM voice_profiles WHERE id = ?").get(id) as
    | { id: string; name: string; samples: string; rules_prompt: string }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "语调档案不存在" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  let samples: string[] = [];
  try {
    samples = body?.samples || JSON.parse(row.samples);
  } catch {
    samples = [row.samples];
  }

  // 重新抽取文风
  const newRules = await extractVoiceRules(samples);

  db.prepare("UPDATE voice_profiles SET rules_prompt = ? WHERE id = ?").run(newRules, id);

  return NextResponse.json({ ok: true, rulesPrompt: newRules });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const res = db.prepare("DELETE FROM voice_profiles WHERE id = ?").run(id);
  if (res.changes === 0) {
    return NextResponse.json({ error: "语调档案不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

async function extractVoiceRules(samples: string[]): Promise<string> {
  const cfg = getByok();
  if (!cfg) {
    return `文风特征约束（重新抽取）：\n1. 平均句长中等偏短，多用断句与金句排比；\n2. 语气理性克制、具思辨深度；\n3. 拒绝套话与空泛修辞，强调论述推进。`;
  }

  try {
    const provider = createOpenAICompatible({
      name: "inkcraft",
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });

    const samplesText = samples.map((s, i) => `【样稿 ${i + 1}】\n${s.slice(0, 1500)}`).join("\n\n---\n\n");
    const { text } = await generateText({
      model: provider.chatModel(cfg.model),
      system: "你是语言学与文风克隆专家。分析创作者的历史样稿，提炼出一套可直接用于指示 AI 写作的文风约束指令（包含句长习惯、修辞口吻、常用词汇风格与行文节奏）。",
      prompt: `【创作者历史样稿】：\n${samplesText}\n\n请输出一段精炼明确的《文风约束提示词》：`,
      temperature: 0.3,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(60_000),
    });

    return text.trim();
  } catch {
    return `文风特征约束：保持样稿中的紧凑结构、专业深度与克制口吻。`;
  }
}
