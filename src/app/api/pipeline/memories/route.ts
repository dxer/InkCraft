import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getProjectById, pickCreatorMemories } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

/** 起草前的记忆联想预览：按选题召回相关的创作者历史速记（已挂载素材排除） */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query : "";
  const projectId = body?.projectId as string | undefined;

  const project = projectId ? getProjectById(projectId) : null;
  const excludeIds = project?.materials?.map((m) => m.itemId) || [];

  const memories = pickCreatorMemories(getDb(), query, excludeIds);

  return NextResponse.json({
    count: memories.length,
    memories: memories.map((m) => ({ id: m.id, title: m.title, excerpt: m.content.slice(0, 120) })),
  });
}
