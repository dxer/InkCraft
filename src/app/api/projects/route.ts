import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  attachMaterialsToProject,
  getOrCreateActiveProject,
  getProjectById,
  pruneEmptyProjects,
} from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const forceNew = searchParams.get("new") === "true";

  if (projectId) {
    const project = getProjectById(projectId);
    if (project) return NextResponse.json({ project });
  }

  const db = getDb();

  // 如果显式请求新项目，或库中完全没有项目，创建干净的初始项目
  if (forceNew) {
    pruneEmptyProjects();
    const id = randomUUID();
    const title = `新装配项目 · ${new Date().toLocaleDateString("zh-CN")}`;
    db.prepare(
      "INSERT INTO pipeline_projects (id, title, current_stage, selected_topic, master_content) VALUES (?, ?, 'ideate', NULL, '')"
    ).run(id, title);
    const project = getProjectById(id);
    return NextResponse.json({ project });
  }

  // 默认返回当前活跃或新项目
  const project = getOrCreateActiveProject();
  return NextResponse.json({ project });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : `新装配项目 · ${new Date().toLocaleDateString("zh-CN")}`;
  const itemIds = Array.isArray(body?.itemIds) ? body.itemIds : [];

  const db = getDb();
  const id = randomUUID();

  let stage = "ideate";
  let finalTitle = title;
  let selectedTopic: string | null = null;

  // 闪念成稿快速通道：以首条素材为骨架直接落位起草工位，跳过 01/02 两步
  if (body?.quickDraft === true && itemIds.length > 0) {
    const note = db
      .prepare("SELECT title FROM knowledge_items WHERE id = ?")
      .get(itemIds[0]) as { title: string | null } | undefined;
    if (note) {
      stage = "draft";
      finalTitle = (note.title || "闪念速写").slice(0, 60);
      selectedTopic = JSON.stringify({
        title: finalTitle,
        angle: "闪念成稿：以该素材为骨架直接起草，跳过选题策划与素材匹配工位",
        outline: [],
      });
    }
  }

  db.prepare(
    "INSERT INTO pipeline_projects (id, title, current_stage, selected_topic, master_content) VALUES (?, ?, ?, ?, '')"
  ).run(id, finalTitle, stage, selectedTopic);

  if (itemIds.length > 0) {
    attachMaterialsToProject(id, itemIds, "manual");
  }

  const created = getProjectById(id);
  return NextResponse.json({ project: created }, { status: 201 });
}
