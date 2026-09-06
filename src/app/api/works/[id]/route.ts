import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getProjectById } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** 删除一件成品（装配项目）：素材挂载、切片勾选、平台变体随外键级联清理 */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const result = db.prepare("DELETE FROM pipeline_projects WHERE id = ?").run(id);
  if (result.changes === 0) {
    return NextResponse.json({ error: "作品不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: "未找到指定作品" }, { status: 404 });
    }

    const db = getDb();
    const variantRows = db
      .prepare(
        `SELECT pv.platform_id, pt.platform_name, pv.content, pv.created_at
         FROM project_variants pv
         JOIN platform_templates pt ON pv.platform_id = pt.id
         WHERE pv.project_id = ?`
      )
      .all(id) as {
      platform_id: string;
      platform_name: string;
      content: string;
      created_at: string;
    }[];

    const variants: Record<string, { name: string; content: string }> = {};
    for (const v of variantRows) {
      variants[v.platform_id] = {
        name: v.platform_name,
        content: v.content,
      };
    }

    return NextResponse.json({
      work: {
        id: project.id,
        title: project.title,
        currentStage: project.currentStage,
        targetSkill: project.targetSkill,
        topicId: project.topicId || null,
        selectedTopic: project.selectedTopic || null,
        masterContent: project.masterContent || "",
        updatedAt: project.updatedAt,
        materials: project.materials,
        variants,
      },
    });
  } catch (error) {
    console.error("[api/works/[id]]", error);
    return NextResponse.json({ error: "获取作品详情失败" }, { status: 500 });
  }
}
