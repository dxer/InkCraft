import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { getByok } from "@/lib/settings";

/**
 * 智鉴：对文本的四维度 AI 分析。
 * 一次运行只做一个维度；workshop/refine 划词接口与 /api/insights 记录接口共用。
 */

export type ZhijianDimension = "expand" | "challenge" | "assess" | "refine";

export const ZHIJIAN_DIMENSIONS: Record<
  ZhijianDimension,
  { label: string; emoji: string; hint: string }
> = {
  expand: { label: "延展", emoji: "🌱", hint: "发散 3 个新讨论切入点" },
  challenge: { label: "反辩", emoji: "🛡️", hint: "红队视角挑漏洞举反例" },
  assess: { label: "解构", emoji: "🔍", hint: "信息密度·情感倾向·逻辑递进" },
  refine: { label: "精炼", emoji: "✨", hint: "转出版级精炼书面语" },
};

const SYSTEM_PROMPTS: Record<ZhijianDimension, string> = {
  expand: [
    "你是想象力旺盛的思想伙伴，特点是高创造力。用户将提供一段选中的文字。",
    "请进行【延展】分析：基于选中文本，向外发散 3 个全新的讨论切入点。",
    "要求：每个切入点给一个小标题与 2-3 句展开，追求跳出原文框架的意外视角与跨领域联想，不重复原文已有观点。",
  ].join("\n"),

  challenge: [
    "你是严苛的红队评审与反方辩手，职责是严谨性审查。用户将提供一段选中的文字。",
    "请进行【反辩】分析：挑出论点的漏洞——未经证实的隐含假设、以偏概全、因果倒置、诉诸情绪等，并为每个漏洞给出具体的反例或反设情境。",
    "要求：按「漏洞 → 反例/反设 → 修补建议」的结构输出，语气犀利但针对论证本身，不做人身评价。",
  ].join("\n"),

  assess: [
    "你是出版级编审与文本分析师。用户将提供一段选中的文字。",
    "请进行【解构】分析：剖析这段文字的信息密度（单位文字承载的有效信息量）、情感倾向（立场、语气与情绪色彩）与逻辑递进关系（句间/段间的推导链条是否成立）。",
    "要求：三个维度分别给出简明剖析与量化评价（如高/中/低或 1-10 分），最后用 1-2 句总评收束。",
  ].join("\n"),

  refine: [
    "你是顶级出版物主编。用户将提供一段选中的文字。",
    "请进行【精炼】改写：剔除口语废话、填充词与冗余修饰，将文字转换为出版级精炼书面语。",
    "要求：直接输出改写后的文本，保留原意与关键信息，不带任何解释或前言。",
  ].join("\n"),
};

export function isZhijianDimension(v: string): v is ZhijianDimension {
  return v in SYSTEM_PROMPTS;
}

/** 未配置 AI 服务时的本地 mock 回退，保证各维度输出结构可演示 */
export function zhijianMockResult(dimension: ZhijianDimension, text: string): string {
  switch (dimension) {
    case "expand":
      return `针对「${text.slice(0, 20)}...」，可从以下三个切入点延展：\n\n1. 【跨界联想】：借另一领域的同构现象，反观这段文字的普适性；\n2. 【极端推演】：把观点推向边界情境，看它会催生什么新问题；\n3. 【时代切片】：放到当下具体的社会与技术语境中，它指向哪个未被讨论的缺口。`;
    case "challenge":
      return `【红队反辩】：\n1. 隐含假设过于绝对——在长周期或极端环境下存在反例；\n2. 缺乏量化证据支撑，易被认为是主观断言。\n建议补充数据源或收窄断言范围。`;
    case "assess":
      return `【解构报告】：\n• 信息密度：中等（核心观点明确，修饰性表述偏多）\n• 情感倾向：温和偏倡导，立场先行于论证\n• 逻辑递进：链条完整，但第二层推导缺少中间桥梁\n总评：可删减铺垫用词，直接切入结论。`;
    case "refine":
    default:
      return `${text.replace(/很多人以为|但是|其实|也就是说/g, "").trim()}（精炼版：表达更凝练，结构已重构）`;
  }
}

export interface ZhijianRunResult {
  content: string;
  isMock: boolean;
}

/** 执行一个维度的分析；未配置 AI 时回落 mock，不抛错 */
export async function runZhijian(
  dimension: ZhijianDimension,
  text: string,
  context = ""
): Promise<ZhijianRunResult> {
  const cfg = getByok();
  if (!cfg) {
    return { content: zhijianMockResult(dimension, text), isMock: true };
  }

  const provider = createOpenAICompatible({
    name: "inkcraft",
    baseURL: cfg.baseUrl,
    apiKey: cfg.apiKey,
  });

  const prompt = context
    ? `【文章前文背景】\n${context}\n\n【待分析文字】\n${text}`
    : `【待分析文字】\n${text}`;

  const { text: result } = await generateText({
    model: provider.chatModel(cfg.model),
    system: SYSTEM_PROMPTS[dimension],
    prompt,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(60_000),
  });

  return { content: result.trim(), isMock: false };
}
