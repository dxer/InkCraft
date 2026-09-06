import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

export interface VoiceProfile {
  id: string;
  name: string;
  samples: string[];
  rulesPrompt: string;
  isDefault: boolean;
  createdAt: string;
}

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM voice_profiles ORDER BY is_default DESC, created_at DESC").all() as {
    id: string;
    name: string;
    samples: string;
    rules_prompt: string | null;
    is_default: number;
    created_at: string;
  }[];

  return NextResponse.json({
    voices: rows.map((r) => {
      let samples: string[] = [];
      try {
        samples = JSON.parse(r.samples);
      } catch {
        samples = [r.samples];
      }
      return {
        id: r.id,
        name: r.name,
        samples,
        rulesPrompt: r.rules_prompt || "",
        isDefault: r.is_default === 1,
        createdAt: r.created_at,
      };
    }),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const samples = Array.isArray(body?.samples) ? body.samples.filter((s: unknown) => typeof s === "string" && s.trim()) : [];

  if (!name) {
    return NextResponse.json({ error: "语调名称不能为空" }, { status: 400 });
  }
  if (samples.length === 0) {
    return NextResponse.json({ error: "至少需要提供一篇历史样稿" }, { status: 400 });
  }

  // 抽取文风提示词
  const rulesPrompt = await extractVoiceRules(samples);

  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO voice_profiles (id, name, samples, rules_prompt, is_default) VALUES (?, ?, ?, ?, 0)"
  ).run(id, name, JSON.stringify(samples), rulesPrompt);

  return NextResponse.json({
    voice: {
      id,
      name,
      samples,
      rulesPrompt,
      isDefault: false,
      createdAt: new Date().toISOString(),
    },
  }, { status: 201 });
}

async function extractVoiceRules(samples: string[]): Promise<string> {
  const cfg = getByok();
  if (!cfg) {
    return `文风特征约束（示例抽取）：\n1. 平均句长中等偏短，多用断句与金句排比；\n2. 语气理性克制、具思辨深度，善用“机制”、“范式”、“本质”等结构化概念；\n3. 拒绝廉价套话与空泛修辞，段落层层推进。`;
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
