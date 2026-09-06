import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content && !title) {
    return NextResponse.json({ error: "笔记内容不能为空" }, { status: 400 });
  }

  const plainText = content.replace(/<[^>]*>/g, "").slice(0, 2000);
  const cfg = getByok();

  if (!cfg) {
    // 智能提取后备算法
    const fallbackTags = extractFallbackTags(title, plainText);
    return NextResponse.json({ tags: fallbackTags, isMock: true });
  }

  try {
    const provider = createOpenAICompatible({
      name: "inkcraft",
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });

    const system = [
      "你是专业知识库管理与标签提取专家。",
      "根据用户提供的文章标题与正文，提取 4~6 个最精准、最适合跨库分类检索的主题标签。",
      "标签要求：",
      "1. 每个标签 2~6 个汉字（例如：认知模型、内容工坊、逻辑重构、AI实战、个人成长、商业思考）；",
      "2. 避免无意义泛词（如：笔记、内容、文章）；",
      "3. 必须严格直接输出 JSON 字符串数组，如 [\"标签1\", \"标签2\", \"标签3\"]，不要包含任何其他说明文字。",
    ].join("\n");

    const prompt = `【文章标题】\n${title || "无标题"}\n\n【文章正文】\n${plainText}`;

    const { text } = await generateText({
      model: provider.chatModel(cfg.model),
      system,
      prompt,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(30_000),
    });

    const parsed = parseJsonArray(text);
    if (parsed.length > 0) {
      return NextResponse.json({ tags: parsed, isMock: false });
    }

    const fallback = extractFallbackTags(title, plainText);
    return NextResponse.json({ tags: fallback, isMock: true });
  } catch {
    const fallback = extractFallbackTags(title, plainText);
    return NextResponse.json({ tags: fallback, isMock: true });
  }
}

function parseJsonArray(raw: string): string[] {
  try {
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    if (Array.isArray(arr)) {
      return arr
        .map((x) => String(x).replace(/^#/, "").trim())
        .filter((x) => x.length >= 2 && x.length <= 10)
        .slice(0, 6);
    }
    return [];
  } catch {
    return [];
  }
}

function extractFallbackTags(title: string, text: string): string[] {
  const candidates = new Set<string>();
  const combined = `${title} ${text}`;

  // 常见高频知识关键词库匹配
  const dictionary = [
    "认知模型",
    "深度思考",
    "知识管理",
    "内容工坊",
    "架构设计",
    "写作方法",
    "AI应用",
    "读书笔记",
    "方法论",
    "商业思维",
    "效率提升",
    "反思复盘",
    "爆款排版",
    "逻辑重构",
    "个人成长",
  ];

  for (const word of dictionary) {
    if (combined.includes(word)) {
      candidates.add(word);
    }
  }

  // 从标题提取名词短语
  if (title) {
    const cleanTitle = title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, " ").trim();
    const parts = cleanTitle.split(/\s+/).filter((p) => p.length >= 2 && p.length <= 6);
    for (const p of parts.slice(0, 2)) {
      candidates.add(p);
    }
  }

  // 补充默认推荐
  if (candidates.size === 0) {
    candidates.add("深度思考");
    candidates.add("知识沉淀");
    candidates.add("方法论");
  }

  return Array.from(candidates).slice(0, 5);
}
