import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { getAgentForStage, getProjectById, pickCreatorMemories } from "@/lib/pipeline";
import { getDb } from "@/lib/db";
import { packChunk } from "@/lib/pack";
import { getByok } from "@/lib/settings";
import type { PlatformSkillId } from "@/lib/types";

export const dynamic = "force-dynamic";

interface MaterialInput {
  title?: string | null;
  content: string;
}

const SKILL_RULES: Record<PlatformSkillId, { role: string; formatRules: string[] }> = {
  wechat: {
    role: "你是微信公众号爆款专栏主笔，擅长撰写具有深度叙事感、情绪共鸣与金句排版的优质长文。",
    formatRules: [
      "1. 大标题（# 标题）：吸睛且有信息增量，引发读者好奇；",
      "2. 黄金开篇：用生活/工作场景、故事或痛点切入，3句话内建立与读者的共鸣；",
      "3. 核心主体：分 2~3 个明确小节（## 章节），单段不超过 3 行，多空行留白，呼吸感强；",
      "4. 认知金句：每个小节提炼 1 句高穿透力的核心金句，单独成段加粗；",
      "5. 结尾升华：升华认知，给出切实可行的行动建议，文末附带一段温暖真诚的读者互动问句；",
      "6. 自然流畅：正文中严禁出现任何形如 [S1]、[S2] 等机械草稿标记，所有论据与案例直接自然叙述。",
    ],
  },
  xiaohongshu: {
    role: "你是小红书头部知识博主，擅长创作高点击率、强收藏价值的爆款干货笔记。",
    formatRules: [
      "1. 双标题：主标题带爆款情绪与抓人关键词（含 1~2 个 Emoji），副标题点明核心价值；",
      "2. 黄金前三行：直击特定人群痛点（如「如果你也……建议先收藏」），3秒锁定注意力；",
      "3. 视觉呼吸与清单：正文采用清单化分点（3~5 条），多使用 Emoji 标记（👉、🔥、💡、📌、✅），短句为主；",
      "4. 截图级金句：提炼 1 句最想让人截图保存的核心认知；",
      "5. 互动与标签：文末留有评论区讨论钩子，并附带 4~6 个精准热门标签（如 #知识干货 #个人成长）；",
      "6. 严禁出现 [S1]、[S2] 等编号标记。",
    ],
  },
  zhihu: {
    role: "你是知乎硬核专业答主与专栏作家，擅长犀利思辨、逻辑拆解与反直觉深度论证。",
    formatRules: [
      "1. 开头直接亮明立场与核心结论（如「谢邀，先说结论：……」或直击问题本质），不绕弯子；",
      "2. 破除常见思维误区（「很多人以为……其实……」），展开底层因果链条；",
      "3. 结构严谨规范：使用 Markdown 二级/三级标题、要点列表，逻辑层层递进；",
      "4. 论证充分：善用数据、实战案例与反例对照，语言克制、理性、信息密度极高；",
      "5. 严禁出现 [S1]、[S2] 等编号标记，案例与数据自然融入论证。",
    ],
  },
  x_thread: {
    role: "你是 X (Twitter) / 即刻上的高影响力创作者，擅长撰写穿透力极强的 1/N 连击推文串（Thread）。",
    formatRules: [
      "1. 1/N 破题 Hook：极其抓人的单句观点或反直觉事实，瞬间激发阅读欲；",
      "2. 2/N ~ N-1/N 单点展开：每条推文只讲 1 个核心要点，2~3 个短句，节奏紧凑，信息密度极高；",
      "3. N/N 总结与 CTA：提炼最核心的一句话，引导读者点赞、转发分享与关注；",
      "4. 每条推文之间使用明显的空行分隔，并标明 1/N、2/N、3/N 序号；",
      "5. 严禁出现 [S1]、[S2] 等编号标记。",
    ],
  },
  master: {
    role: "你是顶尖出版专栏主笔，基于论点与事实原料撰写严谨、深刻、结构完整的出版级母稿。",
    formatRules: [
      "1. 严格使用 Markdown 格式（# 文章大标题，## 各章节二级标题）；",
      "2. 深度展开论述，融合参考素材中的事实、观点与论据；",
      "3. 语言凝练、逻辑紧密，杜绝空话套话与 AI 口味废话，篇幅充实；",
      "4. 严禁在正文中生硬插入 [S1] 等机械标记，如需引用请自然表述来源。",
    ],
  },
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = body?.projectId as string;
  const selectedTopic = body?.selectedTopic;
  const confirmedMaterials: MaterialInput[] = Array.isArray(body?.materials) ? body.materials : [];

  const project = projectId ? getProjectById(projectId) : null;
  const targetSkill = ((body?.targetSkill || project?.targetSkill || "wechat") as PlatformSkillId);
  const skillMeta = SKILL_RULES[targetSkill] || SKILL_RULES.wechat;

  // 文风档案：前端传 voiceProfileId，服务端解析出 rulesPrompt 真正注入生成
  let voiceRules = (body?.voiceRules as string) || "";
  const voiceProfileId = body?.voiceProfileId as string | undefined;
  if (!voiceRules && voiceProfileId && voiceProfileId !== "none") {
    const row = getDb()
      .prepare("SELECT rules_prompt FROM voice_profiles WHERE id = ?")
      .get(voiceProfileId) as { rules_prompt: string | null } | undefined;
    if (row?.rules_prompt) voiceRules = row.rules_prompt;
  }

  const agent = getAgentForStage(targetSkill) || getAgentForStage("draft");

  // 主题与立论：优先卡片快照/题旨/选题
  const claimSnapshot = project?.claimSnapshot || body?.claimSnapshot || null;
  const brief = project?.brief || null;
  const topicTitle = claimSnapshot?.claim || brief?.acceptance || selectedTopic?.title || project?.selectedTopic?.title || project?.title || "未命名创作";
  const topicAngle = selectedTopic?.angle || project?.selectedTopic?.angle || "";
  const topicOutline = selectedTopic?.outline || project?.selectedTopic?.outline || [];

  // 素材包：优先取证切片，回退挂载素材
  const packedSelection =
    project?.chunkSelection?.map((c, i) => ({
      idx: i + 1,
      title: c.noteTitle,
      text: c.packedText || packChunk(c.text),
    })) || [];

  const materialsList: MaterialInput[] =
    packedSelection.length > 0
      ? []
      : confirmedMaterials.length > 0
        ? confirmedMaterials
        : project?.materials?.map((m) => ({ title: m.title, content: m.content })) || [];

  const materialsPrompt = materialsList
    .map((m, i) => `【参考素材/证据 ${i + 1}】${m.title || "资料"}\n${m.content}`)
    .join("\n\n");

  // 创作者记忆：与主题相关的个人速记，自然融入
  const memoryExclude = new Set<string>();
  for (const m of confirmedMaterials) {
    const itemId = (m as MaterialInput & { itemId?: string }).itemId;
    if (itemId && itemId !== "none") memoryExclude.add(itemId);
  }
  for (const m of project?.materials || []) memoryExclude.add(m.itemId);
  const memories = topicTitle
    ? pickCreatorMemories(getDb(), `${topicTitle} ${topicAngle}`, [...memoryExclude])
    : [];
  const memoryPrompt = memories
    .map((m, i) => `【记忆 ${i + 1}】${m.title}：${m.content}`)
    .join("\n");

  const memoryCountHeader = String(memories.length);

  const cfg = getByok();
  if (!cfg) {
    // 模拟流式生成
    let mockDraft = "";
    if (targetSkill === "xiaohongshu") {
      mockDraft = `# ⚡️ 别再盲目存笔记了！90%的人都踩中的知识管理误区 📌

如果你也存了几千条笔记却写不出一篇像样的文章，建议赶紧先看这条 👇

很多人以为笔记存下来就是自己的，但真相往往很扎心：**存下来的不是知识，只是未消化的信息垃圾。**

---

### 🔥 为什么传统的「仓鼠式囤积」正在毁掉你的表达力？

👉 **误区一：只收藏不装配**
知识库的价值永远不在于记了多少字，而在于原料被调用、被锻造成母稿的频率！一个只有 50 条高活跃切片的工坊，远胜过 10000 篇死文档的静态仓库。

👉 **误区二：等待灵感降临**
顶级创作者从来不等灵感，他们有一套标准化的「装配流水线」：
💡 选卡定调 ➔ 快速取证 ➔ 平台直出 ➔ 一鱼多吃

👉 **误区三：抽象写作**
没有假想读者的写作是悬空的。先定主阵地，用精准的语调和读者说话！

---

📌 **一句金句送给同路人：**
> 「知识管理的目标不是记住，而是把原料锻造成能出货的作品。」

💬 **评论区聊聊：** 你平时用什么工具做灵感速记？遇到了哪些痛点？

#知识管理 #内容创作 #生产力工具 #个人成长 #深度思考`;
    } else if (targetSkill === "zhihu") {
      mockDraft = `# ${topicTitle}

**谢邀。先说结论：**

知识库如果不能进入写作装配流程，本质上就是一个数字垃圾场。真正拉开创作者差距的，从来不是信息摄入的多少，而是将原料锻造成可交付作品的结构化能力。

---

## 一、破除认知误区：为什么「囤积笔记」会产生虚假的获得感？

很多人在知识管理上极其勤奋：剪藏网页、划线批注、建立树状文件夹。这种行为在心理学上被称为「收集者谬误」（Collector's Fallacy）——我们误把占有信息的行为，等同于理解并掌握了它。

但真实的知识密度取决于两个维度：
1. **反直觉洞察（Counter-intuitive Insights）**：是否推翻了某种常识偏见；
2. **可调用的论据链条（Evidence Chain）**：能否在 3 秒内调出支撑判断的数据与案例。

## 二、底层逻辑：从「仓储思维」走向「工坊装配」

现代内容生产必须建立敏捷流水线：
- **种子立论**：以极简的一句话观点切入，绝不写真空母稿；
- **定向取证**：围绕核心主张从知识库召回 3~5 个高确定性切片；
- **平台直出**：直接以目标受众的认知结构展开论证。

把知识当原料，把输出当交付，你的知识库才真正具有生命力。`;
    } else if (targetSkill === "x_thread") {
      mockDraft = `1/6 很多人以为内容创作是一场等待灵感的玄学冒险。但真相是：真正拉开创作者差距的，是你把素材原料锻造成可交付作品的工业化能力。🧵👇

2/6 绝大部分人都陷入了「仓鼠式囤积」的陷阱：不断剪藏、标记高光，然后让笔记永远沉睡在硬盘里。存下来的不是知识，只是未消化的信息负债。

3/6 知识库的真实价值，不在于容纳了多少字，而在于原料被调用的频率。一个拥有 50 条高频切片的敏捷工坊，战斗力远超拥有 10,000 篇死文档的静态仓库。

4/6 别再试图先写一篇中立无聊的「抽象母稿」了。带着明确的假想读者与平台语调，直接开枪！主阵地直接成稿，副阵地顺手派生。

5/6 极简创作三步法：
① 挑出卡片核心观点
② 自动挂载支撑证据
③ 一键生成目标平台成稿

6/6 记住这句话：知识管理的目标不是记住，而是出货。如果你觉得有启发，欢迎转发第一条推文并关注我，持续分享本地优先与 AI 协同工作流！`;
    } else {
      // 默认微信公众号风格
      mockDraft = `# ${topicTitle}

很多人以为内容创作是一场等待灵感降临的玄学冒险。但真正拉开创作者差距的，从来不是灵感的丰瘠，而是你把素材原料锻造成可交付作品的工序。

## 一、为什么死记笔记是低效陷阱

在传统的知识管理体系中，创作者极容易陷入“仓鼠式囤积”的误区：不断剪藏网页、标记高光段落、建立层层嵌套的文件夹。然而，存下来的每一条笔记如果不进入后续的写作装配流程，就只是沉睡在磁盘里的死数据。

知识库的价值永远不在于容纳了多少字，而在于其原料被调用、被重组、被装配成独立作品的频率。

> **一个只有 50 条高活跃度切片的工坊，远比一个拥有 10000 篇死文档的静态仓库更有战斗力。**

## 二、平台直出：告别真空写作的悬空感

过去很多工具强调先写一篇中立严肃的母稿，然后再费劲转译。但写文章必须有假想读者与特定语境：

- **公众号** 讲究叙事铺垫与留白金句；
- **小红书** 讲究黄金前三行与清单痛点；
- **知乎** 讲究先亮结论与犀利思辨。

直接选择目标平台开写，让 AI 带着你的个人文风和知识库素材一步到位，才是最顺畅的创作体验。

## 三、把一滴灵感锻造成一篇文章

在这个大模型随手可生成万字套话的时代，高质量内容的稀缺性反而成倍上升。AI 绝不应该替代创作者的思考，而是充当懂你文风的专栏搭档。

从今天起，关掉混乱的聊天框。挑选你知识库里的一张卡片，直接选择技能，开启你的下一篇作品吧。

---

*你有在坚持记录灵感吗？平时最常在哪个平台输出？欢迎在留言区与我交流。*`;
    }

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

  const sanitizedAgentPrompt = agent?.system_prompt
    ? agent.system_prompt
        .replace(/[-*]\s*素材包模式下[，,][^;\n]*[;\n]?/g, "")
        .replace(/\[S\d+\]/g, "")
        .trim()
    : "";

  const system = [
    skillMeta.role,
    sanitizedAgentPrompt ? `【主笔基础准则】：\n${sanitizedAgentPrompt}` : "",
    voiceRules ? `【创作者个人文风与语调要求】：\n${voiceRules}` : "",
    "【重要禁令】：正文中绝对不可出现任何形如 [S1]、[S2]、[Sn] 的机械素材编号标注，所有案例、数据与出处必须以自然流畅的人类语言融入叙事。",
  ].filter(Boolean).join("\n\n");

  const packedPrompt = packedSelection
    .map((s) => `【参考素材/证据 ${s.idx}】《${s.title}》\n${s.text}`)
    .join("\n\n");

  const promptParts: string[] = [
    `【创作主题/核心立论】：${topicTitle}`,
  ];

  if (claimSnapshot) {
    promptParts.push(
      `【知识卡片核心主张】：${claimSnapshot.claim}`,
      claimSnapshot.boundary ? `【适用边界/反例】：${claimSnapshot.boundary}` : "",
      claimSnapshot.cut ? `【切口方向】：${claimSnapshot.cut}` : "",
      claimSnapshot.confidence ? `【论据信度】：${claimSnapshot.confidence}` : ""
    );
  }

  if (topicAngle) promptParts.push(`【切入角度】：${topicAngle}`);
  if (topicOutline.length > 0) promptParts.push(`【建议大纲骨架】：\n${topicOutline.join("\n")}`);

  if (packedPrompt) {
    promptParts.push(`\n【参考素材与证据】：\n${packedPrompt}`);
  } else if (materialsPrompt) {
    promptParts.push(`\n【参考素材原料】：\n${materialsPrompt}`);
  }

  if (memoryPrompt) {
    promptParts.push(`\n【创作者记忆 · 个人过往沉淀】（若相关则自然融入）：\n${memoryPrompt}`);
  }

  promptParts.push(
    `\n【${targetSkill.toUpperCase()} 平台专属排版与行文规范】：\n${skillMeta.formatRules.join("\n")}`,
    "\n【核心要求】：",
    "1. 务必严格遵守上述平台排版规范，输出可直接发布的高水准成稿；",
    "2. 深度融入提供的知识卡片主张与参考素材中的事实论据，所有论据以自然语言叙述；",
    "3. 严禁在正文中出现任何形如 [S1]、[S2] 等机械编号标签；",
    "4. 杜绝空洞套话与无意义寒暄，保持语言鲜活、有态度、信息密度高。"
  );

  const prompt = promptParts.filter(Boolean).join("\n\n");

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
