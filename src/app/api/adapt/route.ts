import { randomUUID } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getByok } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = body?.projectId as string;
  const platformId = body?.platformId as string;
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!platformId) {
    return NextResponse.json({ error: "缺少目标平台 ID" }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "母稿内容不能为空" }, { status: 400 });
  }

  const db = getDb();
  const template = db.prepare("SELECT * FROM platform_templates WHERE id = ?").get(platformId) as
    | { id: string; platform_name: string; system_prompt: string; output_type: string }
    | undefined;

  if (!template) {
    return NextResponse.json({ error: "找不到指定的转译模板" }, { status: 404 });
  }

  let adaptedContent = "";
  const cfg = getByok();

  if (!cfg) {
    adaptedContent = getMockAdaptation(platformId, content);
  } else {
    try {
      const provider = createOpenAICompatible({
        name: "inkcraft",
        baseURL: cfg.baseUrl,
        apiKey: cfg.apiKey,
      });

      const { text } = await generateText({
        model: provider.chatModel(cfg.model),
        system: template.system_prompt,
        prompt: `【待转译母稿全文】：\n${content}\n\n请按要求转译输出：`,
        temperature: 0.7,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(90_000),
      });

      adaptedContent = text.trim();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "转译失败";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // 记录到 project_variants 表
  if (projectId) {
    try {
      const existing = db
        .prepare("SELECT id FROM project_variants WHERE project_id = ? AND platform_id = ?")
        .get(projectId, platformId) as { id: string } | undefined;

      if (existing) {
        db.prepare(
          "UPDATE project_variants SET content = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(adaptedContent, existing.id);
      } else {
        db.prepare(
          "INSERT INTO project_variants (id, project_id, platform_id, content) VALUES (?, ?, ?, ?)"
        ).run(randomUUID(), projectId, platformId, adaptedContent);
      }
    } catch (e) {
      console.error("[variant]", e);
    }
  }

  return NextResponse.json({
    platformId,
    platformName: template.platform_name,
    outputType: template.output_type,
    content: adaptedContent,
  });
}

function getMockAdaptation(platformId: string, content: string): string {
  const firstLine = content.split("\n")[0].replace(/^#*\s*/, "");
  switch (platformId) {
    case "wechat":
      return `▎${firstLine}\n\n很多人以为知识管理的目标是“记住”，但真正拉开创作者差距的，是你把原料锻造成作品的工序。\n\n**流水线比仓库更重要，写作不是囤积，而是装配。**\n\n传统的囤积式笔记有三个致命误区：只存不用、分类越来越深、检索时永远找不到。\n\n▎内容生产的工业化思维\n\n建立四步标准出版工序：\n1. 选题策划：提炼痛点命题；\n2. 素材匹配：检索支撑论据；\n3. 初稿起草：文风流式生成；\n4. 编审审查：逻辑与事实核查。\n\n**主编负责拍板，AI 负责苦力。**\n\n——\n你平时的笔记都写成文章了吗？欢迎在留言区聊聊你的知识管理痛点。`;

    case "xiaohongshu":
      return `🔥 救命！别再把笔记软件当仓库了！从囤积到装配的内容工业化秘籍 💡\n\n【首图金句卡】：\n“知识管理的目标不是记住，而是把原料锻造成作品的工序。”\n\n👉 为什么你的笔记总在吃灰？\n只存不用、越分越乱、永远搜不到...其实是你建错了系统！你建的是仓库，不是工厂！\n\n📌 墨匠四步流水线法：\n① 选题策划：从散点中提炼高传播力命题\n② 素材匹配：跨库检索关联论据与切片\n③ 初稿起草：主笔流式起草深度长文\n④ 金线编审：自检逻辑与事实数据\n\n人机协同才是终极解法：AI 负责打杂，你负责做最终决策 ✨ 赶紧点赞收藏实操起来吧！\n\n#知识管理 #生产力工具 #个人成长 #内容创作 #思考力提升`;

    case "zhihu":
      return `谢邀。先说结论：**知识管理的终点不是记忆与囤积，而是出版级母稿的工业化装配。**\n\n## 一、数字仓鼠的认知陷阱\n\n绝大多数人使用知识库的方式，本质上是“信息囤积狂”。看到好文章就剪藏，遇到金句就高亮，但如果这些素材从不进入写作工步，其资产价值就无限趋近于零。\n\n## 二、工业化流水线的核心优势\n\n1. **工序解耦**：将复杂的写作过程拆解为选题、素材、起草、编审四个独立阶段，极大降低认知负荷；\n2. **人机分工**：机器负责提供穷举候选与论证检索，创作者保留主编裁量权；\n3. **质量可控**：通过严格的编审清单托住作品的底线。\n\n## 三、实践路径建议\n\n建议创作者定期清空未完成列表，以作品交付为导向驱动资料录入。`;

    case "x_thread":
      return `1/5 很多人以为内容创作依赖灵感玄学，但顶级创作者都在用“工业化流水线”生产深度内容 🧵👇\n\n2/5 传统囤积笔记的三个死穴：\n- 只存不用\n- 文件夹越建越深\n- 检索时永远找不到\n你建的是仓库，不是作品工厂。\n\n3/5 解决之道：装配流四工步\n① 选题策划：提炼深层命题\n② 素材匹配：生成论证备忘录\n③ 初稿起草：流式打字快速成形\n④ 金线编审：核查逻辑与事实\n\n4/5 正确的人机协同姿势：\nAI 绝不是替你全自动写废话，而是充当流水线各工位的技工。主编始终是你，AI 提供候选，你做取舍。\n\n5/5 关掉混乱的聊天框，开始搭建你的内容装配线吧。如果本 Thread 对你有启发，欢迎 RT 第一条推文！🔁`;

    default:
      return content;
  }
}
