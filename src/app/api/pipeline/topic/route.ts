import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getAgentForStage, getProjectById } from "@/lib/pipeline";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

export interface TopicOption {
  title: string;
  angle: string;
  outline: string[];
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = body?.projectId as string;
  const promptDirection = (body?.promptDirection as string) || "";

  const project = projectId ? getProjectById(projectId) : null;
  const agent = getAgentForStage("topic");

  const materialsText = project?.materials?.map((m, i) => `【原料 ${i + 1}】${m.title || "闪念"}\n${m.content}`).join("\n\n") || "";

  const cfg = getByok();
  if (!cfg) {
    // 模拟数据回退
    const mockTopics: TopicOption[] = [
      {
        title: "命题 A：为什么死记笔记是知识分子的低效陷阱",
        angle: "批判传统囤积式笔记，直指‘只存不产出’的认知盲区",
        outline: [
          "一、数字仓鼠的幻觉：存下不等于掌握",
          "二、仓库 vs 工厂：内容生产的范式转移",
          "三、从囤积到装配：让每一条笔记都成为作品零件",
        ],
      },
      {
        title: "命题 B：从囤积到装配——内容生产的工业化革命",
        angle: "把出版工序工业化，拆解为‘选题-素材-起草-编审’标准工位",
        outline: [
          "一、传统创作的瓶颈：依赖玄学灵感的不可持续性",
          "二、流水线四步法：如何让深度长文稳定量产",
          "三、人机协同分工：AI 负责苦力，人负责拍板",
        ],
      },
      {
        title: "命题 C：如何让 AI 充当你的金线编审副驾",
        angle: "聚焦 AI 在内容工序中的正确定位——不是代笔，而是高标准审校与提纯",
        outline: [
          "一、为什么直接让 AI 写长文会沦为套话垃圾",
          "二、工位化挂载：在关键节点引入 AI 杠杆",
          "三、主编意志与安全网：构建出版级的质量闭环",
        ],
      },
    ];
    return NextResponse.json({ topics: mockTopics, isMock: true });
  }

  try {
    const provider = createOpenAICompatible({
      name: "inkcraft",
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });

    const userPrompt = [
      "请基于以下素材原料与用户创作方向，提炼 3 个深层切入角度与命题骨架。",
      promptDirection ? `【创作者指定方向】：${promptDirection}` : "",
      materialsText ? `【挂载的知识库原料】：\n${materialsText}` : "【未挂载原料，请基于创作方向自主策划深度选题】",
      "\n要求只输出一个 JSON 格式数组，不要包含任何多余文字，结构如下：",
      `[
        {
          "title": "命题标题（概括核心观点，具传播力）",
          "angle": "核心切入角度与论述重点（1-2句话）",
          "outline": ["一、章节1", "二、章节2", "三、章节3"]
        }
      ]`,
    ].filter(Boolean).join("\n\n");

    const { text } = await generateText({
      model: provider.chatModel(agent?.model || cfg.model),
      system: agent?.system_prompt || "你是资深选题主编，提炼 3 个具有深度和传播力的选题命题与章节骨架。",
      prompt: userPrompt,
      temperature: agent?.temperature || 0.8,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(60_000),
    });

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return NextResponse.json({ topics: parsed, isMock: false });
    }

    return NextResponse.json({ error: "未能解析选题结果" }, { status: 502 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "选题策划失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
