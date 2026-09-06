import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { getAgentForStage, getProjectById, pickCreatorMemories } from "@/lib/pipeline";
import { getDb } from "@/lib/db";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

interface MaterialInput {
  title?: string | null;
  content: string;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = body?.projectId as string;
  const selectedTopic = body?.selectedTopic;
  const confirmedMaterials: MaterialInput[] = Array.isArray(body?.materials) ? body.materials : [];

  // 文风档案：前端传 voiceProfileId，服务端解析出 rulesPrompt 真正注入生成
  let voiceRules = (body?.voiceRules as string) || "";
  const voiceProfileId = body?.voiceProfileId as string | undefined;
  if (!voiceRules && voiceProfileId && voiceProfileId !== "none") {
    const row = getDb()
      .prepare("SELECT rules_prompt FROM voice_profiles WHERE id = ?")
      .get(voiceProfileId) as { rules_prompt: string | null } | undefined;
    if (row?.rules_prompt) voiceRules = row.rules_prompt;
  }

  const project = projectId ? getProjectById(projectId) : null;
  const agent = getAgentForStage("draft");

  const topicInfo = selectedTopic || project?.selectedTopic;
  if (!topicInfo?.title) {
    return new Response(JSON.stringify({ error: "缺少选题信息" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const materialsList: MaterialInput[] =
    confirmedMaterials.length > 0
      ? confirmedMaterials
      : project?.materials?.map((m) => ({ title: m.title, content: m.content })) || [];

  const materialsPrompt = materialsList
    .map((m, i) => `【参考素材/证据 ${i + 1}】${m.title || "资料"}\n${m.content}`)
    .join("\n\n");

  // 创作者记忆：与选题相关的个人速记，起草时自然融入
  const memoryExclude = new Set<string>();
  for (const m of confirmedMaterials) {
    const itemId = (m as MaterialInput & { itemId?: string }).itemId;
    if (itemId && itemId !== "none") memoryExclude.add(itemId);
  }
  for (const m of project?.materials || []) memoryExclude.add(m.itemId);
  const memories = pickCreatorMemories(
    getDb(),
    `${topicInfo.title} ${topicInfo.angle || ""}`,
    [...memoryExclude]
  );
  const memoryPrompt = memories
    .map((m, i) => `【记忆 ${i + 1}】${m.title}：${m.content}`)
    .join("\n");

  const memoryCountHeader = String(memories.length);

  const cfg = getByok();
  if (!cfg) {
    // 模拟流式生成
    const mockDraft = `# ${topicInfo.title}

很多人以为内容创作是一场等待灵感降临的玄学冒险，但真正拉开创作者差距的，从来不是灵感的丰瘠，而是你把素材原料锻造成可交付作品的工业化工序。

## ${topicInfo.outline?.[0] || "一、为什么死记笔记是低效陷阱"}

在传统的知识管理体系中，创作者极容易陷入“仓鼠式囤积”的误区：不断剪藏网页、标记高光段落、建立层层嵌套的文件夹。然而，存下来的每一条笔记如果不进入后续的写作装配流程，就只是沉睡在磁盘里的死数据。

知识库的价值永远不在于容纳了多少字，而在于其原料被调用、被重组、被装配成独立母稿的频率。从这个意义上讲，一个只有 50 条高活跃度切片的工坊，远比一个拥有 10000 篇死文档的静态仓库更有战斗力。

## ${topicInfo.outline?.[1] || "二、流水线四步法：让深度长文稳定量产"}

要摆脱对偶然灵感的依赖，就必须建立标准化的出版流水线。墨匠所践行的装配流，将一篇深度文章的诞生拆解为不可逆的严谨工步：

1. **选题策划**：从散乱碎片中提炼切中痛点的深层命题与三段式骨架；
2. **素材匹配**：借助倒排索引与语义检索，生成支撑核心论点的论证备忘录；
3. **初稿起草**：挂载文风语调档案，在确定骨架下快速生成高密度初稿；
4. **金线编审**：执行自检清单，筛查逻辑断层、前后矛盾与事实可信度。

每一步只做一件事，人机各司其职——机器提供海量候选与苦力劳动，主编保留最终拍板与审美裁量权。

## ${topicInfo.outline?.[2] || "三、主编意志：人机协同的黄金法则"}

在这个大模型随手可生成万字套话的时代，高质量内容的稀缺性反而成倍上升。AI 绝不应该替代创作者的思考，而是充当流水线各工位的得力技工。

当你划选任意一段文字呼出推敲浮标时，不论是拓宽、质疑、评估还是精校，最终都必须经过预览卡的确认。主编的意志决定了文章的灵魂，而工序则托住了作品的质量底线。从今天起，关掉混乱的聊天框，在你的装配流水线上，锻造下一篇传世作品。`;

    return new Response(mockDraft, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Is-Mock": "true",
        "X-Memory-Count": memoryCountHeader,
      },
    });
  }

  const provider = createOpenAICompatible({
    name: "inkcraft",
    baseURL: cfg.baseUrl,
    apiKey: cfg.apiKey,
  });

  const system = [
    agent?.system_prompt || "你是顶尖专栏主笔，基于选题骨架和论证素材撰写出版级深度长文母稿。",
    voiceRules ? `【文风与语调要求】：\n${voiceRules}` : "",
  ].filter(Boolean).join("\n\n");

  const prompt = [
    `【文章主标题/命题】：${topicInfo.title}`,
    `【切入角度】：${topicInfo.angle || ""}`,
    `【章节大纲骨架】：\n${(topicInfo.outline || []).join("\n")}`,
    materialsPrompt ? `\n【采纳的论证备忘录与素材原料】：\n${materialsPrompt}` : "",
    memoryPrompt
      ? `\n【创作者记忆 · 个人沉淀的事实与偏好】（若与主题相关则自然融入行文，不必生硬罗列）：\n${memoryPrompt}`
      : "",
    "\n【写作要求】：",
    "1. 严格按照大纲结构展开，使用 Markdown 格式（以 # 作为文章大标题，## 作为各章节二级标题）；",
    "2. 深度展开论述，融合参考素材中的事实、观点与论据；",
    "3. 语言凝练、逻辑紧密，杜绝空话套话与 AI 口味废话；",
    "4. 生成完整长文（1500~3000 字）。",
  ].join("\n\n");

  const result = streamText({
    model: provider.chatModel(agent?.model || cfg.model),
    system,
    prompt,
    temperature: agent?.temperature || 0.7,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(120_000),
  });

  const stream = result.toTextStreamResponse();
  const headers = new Headers(stream.headers);
  headers.set("X-Memory-Count", memoryCountHeader);
  return new Response(stream.body, { status: stream.status, headers });
}
