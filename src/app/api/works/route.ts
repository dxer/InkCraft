import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { markdownLength } from "@/lib/utils";

export const dynamic = "force-dynamic";

function extractTitleFromContent(content: string | null, fallback: string): string {
  if (!content || !content.trim()) return fallback;
  const match = content.match(/^#+\s+(.+)$/m);
  if (match && match[1]) {
    const clean = match[1].replace(/[*_`~#]/g, "").trim();
    if (clean) return clean;
  }
  const firstLine = content.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (firstLine) {
    const clean = firstLine.replace(/^[#>*_\-\s]+/, "").trim();
    if (clean) return clean.slice(0, 60);
  }
  return fallback;
}

export async function GET() {
  const db = getDb();
  // 仅查询正文已完成（字数有效）或标记为完成的正式作品成果，排除仅点击去创作但未完成的空白/半成品草稿
  const projects = db
    .prepare(
      `SELECT * FROM pipeline_projects
       WHERE (master_content IS NOT NULL AND length(trim(master_content)) >= 50)
          OR current_stage = 'completed'
       ORDER BY updated_at DESC`
    )
    .all() as {
    id: string;
    title: string;
    current_stage: string;
    target_skill: string | null;
    topic_id: string | null;
    selected_topic: string | null;
    card_id: string | null;
    master_content: string | null;
    updated_at: string;
  }[];

  const variants = db
    .prepare(
      `SELECT pv.project_id, pt.platform_name
       FROM project_variants pv
       JOIN platform_templates pt ON pv.platform_id = pt.id`,
    )
    .all() as { project_id: string; platform_name: string }[];

  const variantMap = new Map<string, string[]>();
  for (const v of variants) {
    const list = variantMap.get(v.project_id) || [];
    list.push(v.platform_name);
    variantMap.set(v.project_id, list);
  }

  const works = projects.map((p) => {
    let parsedTopic: any = null;
    if (p.selected_topic) {
      try {
        parsedTopic = JSON.parse(p.selected_topic);
      } catch {}
    }

    return {
      id: p.id,
      title: extractTitleFromContent(p.master_content, p.title),
      rawTitle: p.title,
      currentStage: p.current_stage,
      targetSkill: p.target_skill || "wechat",
      topicId: p.topic_id || null,
      topicTitle: parsedTopic?.title || null,
      topicAngle: parsedTopic?.angle || null,
      topicHook: parsedTopic?.hook || null,
      cardId: p.card_id || null,
      wordCount: p.master_content ? markdownLength(p.master_content) : 0,
      updatedAt: p.updated_at,
      variants: variantMap.get(p.id) || [],
    };
  });

  return NextResponse.json({ works });
}
