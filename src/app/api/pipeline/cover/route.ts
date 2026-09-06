import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getDb } from "@/lib/db";
import { getByok } from "@/lib/settings";
import { extractCleanSvg, validateCoverSvg, type CoverOptions } from "@/lib/svg-cover";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CoverOptions;
  const {
    title = "深度思考与知识沉淀",
    highlightWord = "",
    category = "深度特稿",
    stylePreference = "wired",
    showMasthead = true,
    showBarcode = true,
    showNoise = true,
    showSeal = true,
  } = body;

  // 未配置模型：明确提示而不是产出内建占位
  const cfg = getByok();
  if (!cfg || !cfg.apiKey) {
    return NextResponse.json(
      { error: "尚未配置大模型端点。请先在「设置」中填写模型地址与密钥后再使用 AI 封面生成。" },
      { status: 503 }
    );
  }

  const db = getDb();
  const agent = db.prepare("SELECT * FROM custom_agents WHERE stage = 'cover' OR id = 'skill_cover' LIMIT 1").get() as any;

  const systemPrompt = `你是顶尖的杂志视觉设计总监，专门为微信公众号生成标准 2.35:1 比例（viewBox="0 0 900 383"）的顶级杂志大标题封面，直接输出可在浏览器与微信后台上一致渲染的纯 SVG XML 代码。

必须遵守的硬性规范：
1. 根元素必须为：<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 383" width="900" height="383" role="img" preserveAspectRatio="xMidYMid meet">
   并在 <svg> 内紧随其后提供 <title>（文章标题）与 <desc>（一句画面描述）；
2. 首个绘制元素必须是覆盖全画布的背景 <rect x="0" y="0" width="900" height="383" .../>；
3. 构图采用三层：背景（渐变/微粒）→ 中景（抽象几何隐喻）→ 前景（标题文字），严禁"纯色平底 + 漂浮文字"的 PPT 观感；
4. 配色克制：单一主背景色 + 1~2 个强调色，渐变叠加不超过 3 个色停；
5. 文字排版：默认中文字体栈为 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', system-ui, sans-serif；标题要有明确的字重与字距意图，核心关键词用高对比的高亮色块（<rect>）衬托；
6. 公众号居中安全区：所有标题/徽章/印章文字必须位于 x:20~880, y:30~353 的居中区域内，保证微信列表裁切时标题不遮挡；
7. 风格约束（你被指定使用 ${stylePreference} 风格）：
   - wired：深灰蓝渐变背景 + 荧光绿 #22c55e 高亮 + 赛博点阵网格 + 条形码；
   - business：深藏蓝渐变 #0b132b + 琥珀明黄 #fbbf24 高亮 + 纯白粗黑标题；
   - monocle：米白 #fbfaf6 纸张底 + 深炭黑 #18181b 衬线标题 + 细线框 + 朱红方印 #dc2626；
   - swiss：纯黑底 + 烈焰红 #e11d48 / 纯白极简大字报排版；
8. 元素开关（严格遵循）：
   - 杂志刊头 = ${showMasthead}：${showMasthead ? "包含顶部刊头（如 INKCRAFT · 2026 与分类）" : "不含顶部刊头"};
   - 条形码 = ${showBarcode}：${showBarcode ? "在底栏绘制矢量条形码 Barcode" : "不含条形码"};
   - 胶片噪点 = ${showNoise}：${showNoise ? "在 <defs> 注入 <filter><feTurbulence> 纸张噪点" : "使用纯净渐变，不加噪点"};
   - 墨匠方印 = ${showSeal}：${showSeal ? "右下角保留朱红「匠」字方印" : "不含方印"};
9. 精准高亮：必须在用户指定的关键词「${highlightWord}」处绘制独立加粗高亮底色块（<rect>）衬托文字；
10. 严禁使用 <script>、<foreignObject>、<iframe>、@import、data: URI、外链 URL 或远程字体，保证纯本地矢量一致渲染。

直接输出合法的 <svg ...>...</svg> 源码，不要输出任何解释性文字。`;

  const userPrompt = `请为以下文章设计一张纯粹的杂志大标题微信公众号 SVG 封面图：
- 文章主标题：${title}
- 重点高亮关键词：${highlightWord || "核心词"}
- 分类标签：${category}
- 杂志风格：${stylePreference}
- 元素开关：刊头(${showMasthead})，条形码(${showBarcode})，噪点(${showNoise})，印章(${showSeal})

请直接输出符合 900x383 尺寸、含 role="img" 与 <title>/<desc> 的顶级杂志排版 SVG XML 源码：`;

  try {
    const provider = createOpenAICompatible({
      name: "inkcraft",
      baseURL: cfg.baseUrl || "https://api.openai.com/v1",
      apiKey: cfg.apiKey,
    });

    const { text } = await generateText({
      model: provider.chatModel(agent?.model || cfg.model || "deepseek-chat"),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: agent?.temperature || 0.6,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(150_000),
    });

    const cleanSvg = extractCleanSvg(text);
    if (!cleanSvg) {
      return NextResponse.json(
        { error: "AI 未返回有效的 SVG 代码，请重试或更换模型。" },
        { status: 422 }
      );
    }

    const validation = validateCoverSvg(cleanSvg);
    if (!validation.ok) {
      // 校验不过则附上具体违规项，帮助了解问题；如有合规优化可以重试
      return NextResponse.json(
        { error: `AI 生成的封面未通过合规校验：${validation.errors.join("；")}` },
        { status: 422 }
      );
    }

    return NextResponse.json({ svg: cleanSvg, isMock: false });
  } catch (error: unknown) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        error.name === "AbortError" ||
        /timeout|aborted/i.test(error.message || ""));
    console.warn("[api/pipeline/cover] AI 生成封面异常:", error);

    if (isTimeout) {
      return NextResponse.json(
        { error: "AI 生成耗时较长，已超过限制。请缩小标题/精简高亮词后重试，或更换响应更快的模型。" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "AI 生成封面失败，请检查模型配置或网络后重试。" },
      { status: 500 }
    );
  }
}