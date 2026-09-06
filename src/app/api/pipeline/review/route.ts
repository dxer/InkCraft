import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getAgentForStage, getProjectById } from "@/lib/pipeline";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

export interface ChecklistItem {
  key: "claim" | "facts" | "avoid" | "cadence";
  label: string;
  pass: boolean;
  note: string;
}

export interface ReviewReport {
  score: number;
  verdict: string;
  /** 机械校验：母稿中无法指回素材包的数字清单 */
  untraceable: string[];
  checklist: ChecklistItem[];
  overallSummary: string;
}

const LABELS: Record<ChecklistItem["key"], string> = {
  claim: "主张是否被写大",
  facts: "关键事实能否指回素材",
  avoid: "「不写什么」是否被遵守",
  cadence: "是否卡片腔",
};

/** 机械先行：抽取母稿中的数字，逐一核对能否在素材包中找到 */
function mechanicalNumberCheck(
  content: string,
  sourceTexts: string[]
): string[] {
  if (sourceTexts.length === 0) return [];
  const sentences = content.split(/(?<=[。！？!?；;])/).map((s) => s.trim());
  const numbers = Array.from(new Set(content.match(/\d+(?:\.\d+)?%?/g) || []));
  const untraceable: string[] = [];
  for (const n of numbers) {
    if (n === "0" || /^(19|20)\d{2}$/.test(n)) continue; // 常识数字/年份放行
    const traceable =
      sourceTexts.some((t) => t.includes(n)) ||
      /\[S\d+\]/.test(content.split(n)[0].slice(-80));
    if (!traceable) {
      const where = sentences.find((s) => s.includes(n)) || n;
      untraceable.push(where.length > 60 ? `${where.slice(0, 60)}…（含 ${n}）` : where);
    }
  }
  return untraceable.slice(0, 8);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "母稿内容不能为空" }, { status: 400 });
  }

  const project = projectId ? getProjectById(projectId) : null;
  const agent = getAgentForStage("review");
  const cfg = getByok();

  // 素材包文本：机械校验与核稿依据
  const sourceTexts: string[] = (project?.chunkSelection || []).map(
    (c) => `${c.packedText || ""} ${c.text}`
  );
  const claimText =
    project?.claimSnapshot?.claim || project?.brief?.acceptance || "";
  const avoidText = project?.brief?.avoid || "";
  const untraceable = mechanicalNumberCheck(content, sourceTexts);

  const buildReport = (llm: Partial<{
    score: number;
    verdict: string;
    checklist: { key: string; pass: boolean; note: string }[];
    overallSummary: string;
  }> | null): ReviewReport => {
    const items: ChecklistItem[] = (["claim", "facts", "avoid", "cadence"] as const).map(
      (key) => {
        const found = llm?.checklist?.find((c) => c.key === key);
        return {
          key,
          label: LABELS[key],
          pass: key === "facts" && untraceable.length > 0 ? false : (found?.pass ?? true),
          note: found?.note || "",
        };
      }
    );
    const allPass = items.every((i) => i.pass);
    // 分数由清单推导（每项 25 分），不采信模型自报；0 项挂 = 100
    const fails = items.filter((i) => !i.pass).length;
    const score = typeof llm?.score === "number" && llm.score > 0 ? llm.score : 100 - fails * 25;
    return {
      score,
      verdict: llm?.verdict || (allPass ? "核稿通过" : "存在未通过项"),
      untraceable,
      checklist: items,
      overallSummary: llm?.overallSummary || "",
    };
  };

  if (!cfg) {
    return NextResponse.json({
      report: buildReport({
        score: 88,
        verdict: "演示核稿通过",
        checklist: [
          { key: "claim", pass: true, note: "演示数据：主张未被写大" },
          { key: "facts", pass: untraceable.length === 0, note: untraceable.length > 0 ? `有 ${untraceable.length} 处数字未溯源` : "演示数据：事实均可指回素材" },
          { key: "avoid", pass: true, note: "演示数据：未触碰禁区" },
          { key: "cadence", pass: true, note: "演示数据：无卡片腔" },
        ],
        overallSummary: "未配置模型，当前为演示核稿结果。",
      }),
      isMock: true,
    });
  }

  try {
    const provider = createOpenAICompatible({
      name: "inkcraft",
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });

    const userPrompt = [
      claimText ? `【主张/题旨基准】：${claimText}` : "",
      avoidText ? `【不写什么】：${avoidText}` : "",
      sourceTexts.length > 0
        ? `【素材包内容（事实唯一来源）】：\n${sourceTexts.map((t, i) => `[S${i + 1}] ${t.slice(0, 400)}`).join("\n")}`
        : "",
      `【机械校验：以下数字在素材中未找到出处，请逐条核实并定位】：\n${untraceable.length > 0 ? untraceable.join("\n") : "无"}`,
      `【成文母稿】：\n${content.slice(0, 12000)}`,
      "\n执行四项核稿，只输出一个 JSON 对象，不要多余文字：",
      `{
        "score": 0,
        "verdict": "10字内总评",
        "checklist": [
          { "key": "claim", "pass": true, "note": "一句话定位：哪段写大了/为何通过" },
          { "key": "facts", "pass": true, "note": "结合机械校验结果定位问题句" },
          { "key": "avoid", "pass": true, "note": "违规处定位/为何通过" },
          { "key": "cadence", "pass": true, "note": "模板腔定位/为何通过" }
        ],
        "overallSummary": "50字内总结"
      }`,
    ].filter(Boolean).join("\n\n");

    const { text } = await generateText({
      model: provider.chatModel(agent?.model || cfg.model),
      system:
        agent?.system_prompt ||
        "你是严苛的核稿总编。主张是否被写大、事实能否指回素材、禁区是否被遵守、是否卡片腔，一项不过即不通过。",
      prompt: userPrompt,
      temperature: agent?.temperature ?? 0.2,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(90_000),
    });

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return NextResponse.json({ report: buildReport(parsed), isMock: false });
    }

    return NextResponse.json({ error: "未能解析核稿结果" }, { status: 502 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "核稿失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
