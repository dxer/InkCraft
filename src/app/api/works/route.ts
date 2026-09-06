import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { markdownLength } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const projects = db
    .prepare("SELECT * FROM pipeline_projects ORDER BY updated_at DESC")
    .all() as {
    id: string;
    title: string;
    current_stage: string;
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

  const works = projects.map((p) => ({
    id: p.id,
    title: p.title,
    currentStage: p.current_stage,
    wordCount: p.master_content ? markdownLength(p.master_content) : 0,
    updatedAt: p.updated_at,
    variants: variantMap.get(p.id) || [],
  }));

  return NextResponse.json({ works });
}
