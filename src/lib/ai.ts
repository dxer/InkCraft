import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { getByok, type ByokConfig } from "./settings";

export { isAiConfigured } from "./settings";

export interface TidyMeta {
  title?: string;
  category?: string;
  tags?: string[];
}

/**
 * 一次 LLM 调用完成元数据整理（起标题 / 归分类 / 打标签）。
 * 走 BYOK 单通道；兼容各家 OpenAI 兼容端点，故用 generateText +
 * 宽松 JSON 提取，而非依赖结构化输出能力。
 */
export async function tidyContent(content: string): Promise<TidyMeta | null> {
  const cfg = getByok();
  if (!cfg) return null;
  // 长文取首尾拼接：头部承载主题，尾部承载结论，避免中段截断丢主题
  const clipped =
    content.length > 2000 ? `${content.slice(0, 1500)}\n……\n${content.slice(-500)}` : content;
  const obj = await generateJson(cfg, TIDY_SYSTEM, clipped);
  if (!obj) return null;
  const tags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === "string").slice(0, 5)
    : [];
  return {
    title: typeof obj.title === "string" ? obj.title.slice(0, 60) : undefined,
    category: typeof obj.category === "string" ? obj.category.slice(0, 20) : undefined,
    tags: tags.length > 0 ? tags : undefined,
  };
}

const TIDY_SYSTEM = [
  "你是个人知识库的归档管理员。根据给定内容生成元数据，只输出一个 JSON 对象，不要输出任何其他文字。字段：",
  '"title": 简洁标题，不超过 20 字，概括核心主题，不加书名号和句号',
  '"category": 最贴切的一个分类词，2-6 字（如：认知模型、AI 落地、读书剪藏、写作工序、通用）',
  '"tags": 3-5 个主题标签组成的数组，每项 2-6 字',
].join("\n");

async function generateJson(
  cfg: ByokConfig,
  system: string,
  prompt: string
): Promise<Record<string, unknown> | null> {
  const provider = createOpenAICompatible({
    name: "inkcraft",
    baseURL: cfg.baseUrl,
    apiKey: cfg.apiKey,
  });
  const { text } = await generateText({
    model: provider.chatModel(cfg.model),
    system,
    prompt,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(60_000),
  });
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** 入库后异步整理：失败只记日志，绝不阻塞入库主流程 */
export function runTidy(task: Promise<unknown>): void {
  task.catch((err) => console.error("[tidy]", err));
}
