import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const STAGE_LABELS: Record<string, string> = {
  topic: "01 选题策划",
  evidence: "02 素材匹配",
  draft: "03 初稿起草",
  review: "04 编审审查",
};

/** 全量导出为单个 Markdown 文件：知识条目 + 装配成果，纯文本可读可迁移 */
export async function GET() {
  const db = getDb();

  const kbRows = db
    .prepare("SELECT id, name, description FROM knowledge_bases ORDER BY is_default DESC, created_at ASC")
    .all() as { id: string; name: string; description: string | null }[];

  const itemRows = db
    .prepare(
      `SELECT ki.id, COALESCE(ki.kb_id, 'default') as kb_id, ki.title, ki.content, ki.tags, ki.category, ki.created_at
       FROM knowledge_items ki
       WHERE ki.chunk_index IS NULL
       ORDER BY COALESCE(ki.kb_id, 'default') ASC, ki.created_at ASC`
    )
    .all() as {
    id: string;
    kb_id: string;
    title: string | null;
    content: string;
    tags: string | null;
    category: string | null;
    created_at: string;
  }[];

  const projectRows = db
    .prepare(
      "SELECT id, title, current_stage, master_content, updated_at FROM pipeline_projects ORDER BY updated_at ASC"
    )
    .all() as {
    id: string;
    title: string;
    current_stage: string;
    master_content: string | null;
    updated_at: string;
  }[];

  const parts: string[] = [
    `# 墨匠 InkCraft · 全量导出`,
    "",
    `> 导出时间：${new Date().toLocaleString("zh-CN")}`,
    `> 知识条目 ${itemRows.length} 条 · 装配成果 ${projectRows.length} 篇 · 知识库 ${kbRows.length} 个`,
    "",
    "---",
    "",
    "# 一、知识库",
    "",
  ];

  for (const kb of kbRows) {
    const items = itemRows.filter((i) => i.kb_id === kb.id);
    parts.push(`## 📁 ${kb.name}${kb.description ? ` — ${kb.description}` : ""}`);
    parts.push("");
    if (items.length === 0) {
      parts.push("_（空）_");
      parts.push("");
      continue;
    }
    for (const item of items) {
      const tags = (() => {
        try {
          const parsed = JSON.parse(item.tags || "[]");
          return Array.isArray(parsed) ? parsed.map((t) => `#${t}`).join(" ") : "";
        } catch {
          return "";
        }
      })();
      parts.push(`### ${item.title || "未命名笔记"}`);
      parts.push("");
      const meta: string[] = [];
      if (tags) meta.push(`标签：${tags}`);
      if (item.category && item.category !== "通用") meta.push(`分类：${item.category}`);
      meta.push(`创建：${item.created_at}`);
      parts.push(`> ${meta.join(" · ")}`);
      parts.push("");
      parts.push(item.content);
      parts.push("");
      parts.push("---");
      parts.push("");
    }
  }

  parts.push("# 二、装配成果");
  parts.push("");
  if (projectRows.length === 0) {
    parts.push("_（空）_");
  }
  for (const p of projectRows) {
    parts.push(`## ${p.title}（${STAGE_LABELS[p.current_stage] || p.current_stage}）`);
    parts.push("");
    parts.push(`> 更新：${p.updated_at}`);
    parts.push("");
    parts.push(p.master_content?.trim() || "_（尚未成稿）_");
    parts.push("");
    parts.push("---");
    parts.push("");
  }

  const date = new Date().toISOString().slice(0, 10);
  return new Response(parts.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="inkcraft-export-${date}.md"`,
    },
  });
}
