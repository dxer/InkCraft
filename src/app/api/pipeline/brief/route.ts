import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { BRIEF_AGENT_DEFAULT_PROMPT, BRIEF_AGENT_NAME } from "@/lib/db";
import { getAgentForStage, getProjectById } from "@/lib/pipeline";
import { getByok } from "@/lib/settings";
import type { PipelineProject, TopicBrief } from "@/lib/types";

export const dynamic = "force-dynamic";

const FALLBACK_BRIEF: TopicBrief = {
  audience: "随取证补充",
  acceptance: "随取证补充",
  intent: "随取证补充",
  avoid: "随取证补充",
};

function sanitizeBrief(raw: Record<string, unknown>): TopicBrief | null {
  const pick = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "";
  const brief = {
    audience: pick(raw.audience, 40),
    acceptance: pick(raw.acceptance, 60),
    intent: pick(raw.intent, 60),
    avoid: pick(raw.avoid, 80),
  };
  // 至少要有「要接受的那句话」才算有效题旨
  return brief.acceptance ? brief : null;
}

/** 组装锁题输入：卡片模式用主张快照，非卡片模式用已选定命题 */
function briefSourceText(project: PipelineProject): string {
  if (project.claimSnapshot) {
    const c = project.claimSnapshot;
    const lines = [
      `【卡片主张】${c.claim}`,
      c.boundary ? `【卡片边界】${c.boundary}` : "",
      c.cut ? `【卡片切口】${c.cut}` : "",
      c.confidence ? `【信度】${c.confidence}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }
  const t = project.selectedTopic;
  if (t) {
    return [
      `【选题命题】${t.title}`,
      t.angle ? `【切入角度】${t.angle}` : "",
      t.outline && t.outline.length > 0 ? `【章节骨架】${t.outline.join(" / ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return `【创作方向】${project.title}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const project = projectId ? getProjectById(projectId) : null;
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  const agent = getAgentForStage("brief");
  const cfg = getByok();
  if (!cfg) {
    // 模拟回退：从主张/命题直取，标注 isMock
    const source = project.claimSnapshot?.claim || project.selectedTopic?.title || project.title;
    return NextResponse.json({
      brief: { ...FALLBACK_BRIEF, acceptance: source.slice(0, 40) },
      isMock: true,
    });
  }

  try {
    const provider = createOpenAICompatible({
      name: "inkcraft",
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });

    const { text } = await generateText({
      model: provider.chatModel(agent?.model || cfg.model),
      system: agent?.system_prompt || BRIEF_AGENT_DEFAULT_PROMPT,
      prompt: `${briefSourceText(project)}\n\n请产出四行题旨。`,
      temperature: agent?.temperature ?? 0.2,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(60_000),
    });

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) {
      return NextResponse.json({ error: "未能解析题旨结果" }, { status: 502 });
    }
    const brief = sanitizeBrief(JSON.parse(text.slice(start, end + 1)));
    if (!brief) {
      return NextResponse.json({ error: "题旨缺少「要接受的那句话」，请重试" }, { status: 502 });
    }
    return NextResponse.json({ brief, agent: agent?.name || BRIEF_AGENT_NAME, isMock: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "锁题失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
