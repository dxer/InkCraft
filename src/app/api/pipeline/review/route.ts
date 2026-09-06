import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getAgentForStage } from "@/lib/pipeline";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

export interface ReviewReport {
  score: number;
  verdict: string;
  logicIssues: { issue: string; suggestion: string }[];
  densityNotes: { finding: string; suggestion: string }[];
  factChecks: { statement: string; credibility: "high" | "medium" | "unverified"; note: string }[];
  overallSummary: string;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "母稿内容不能为空" }, { status: 400 });
  }

  const agent = getAgentForStage("review");
  const cfg = getByok();

  if (!cfg) {
    const mockReport: ReviewReport = {
      score: 88,
      verdict: "出版级达标 · 论据充实，逻辑严密",
      logicIssues: [
        {
          issue: "第二章节转入第三章节时缺少一句承上启下的过渡连接",
          suggestion: "建议在‘流水线四步法’末尾增加一句说明人机分工如何支撑流水线的落地。",
        },
      ],
      densityNotes: [
        {
          finding: "首段前两句存在部分铺垫修辞",
          suggestion: "可直接删除‘在传统的知识管理体系中’等套话，开门见山提出核心命题。",
        },
      ],
      factChecks: [
        {
          statement: "流水线四步法包括：选题、素材、起草、编审",
          credibility: "high",
          note: "与工坊定义完全吻合",
        },
        {
          statement: "高密度初稿字数区间在 1500~3000 字",
          credibility: "high",
          note: "出版标准长文字数基线",
        },
        {
          statement: "存下来的每一条笔记如果不进入后续装配就是死数据",
          credibility: "medium",
          note: "属观点性断言，论述自洽但可补充具体案例",
        },
      ],
      overallSummary:
        "整篇母稿结构非常紧凑，四步装配流的核心论据充分展开。建议根据上述编审意见在右侧画布微调后直接进入分发转译。",
    };
    return NextResponse.json({ report: mockReport, isMock: true });
  }

  try {
    const provider = createOpenAICompatible({
      name: "inkcraft",
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });

    const userPrompt = [
      `【成稿母稿内容】：\n${content}`,
      "\n请以出版级总编标准执行全流程审校，只输出一个 JSON 格式对象，不要包含多余文字：",
      `{
        "score": 85, // 0-100 总分
        "verdict": "简要总体评语（10字以内）",
        "logicIssues": [
          { "issue": "发现的逻辑断层或矛盾", "suggestion": "修改建议" }
        ],
        "densityNotes": [
          { "finding": "废话或信息密度不足之处", "suggestion": "精简建议" }
        ],
        "factChecks": [
          { "statement": "文中的关键事实/数据/论断", "credibility": "high/medium/unverified", "note": "核查说明" }
        ],
        "overallSummary": "综合审校报告总结（100字左右）"
      }`,
    ].join("\n\n");

    const { text } = await generateText({
      model: provider.chatModel(agent?.model || cfg.model),
      system: agent?.system_prompt || "你是严苛的总编，审查母稿逻辑、信息密度与事实数据可信度。",
      prompt: userPrompt,
      temperature: agent?.temperature || 0.4,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(90_000),
    });

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return NextResponse.json({ report: parsed, isMock: false });
    }

    return NextResponse.json({ error: "未能解析审校报告" }, { status: 502 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "编审审查失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
