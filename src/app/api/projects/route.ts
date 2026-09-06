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

  try {
    const targetSkill = typeof body?.targetSkill === "string" ? body.targetSkill : "wechat";
    const topicId = typeof body?.topicId === "string" && body.topicId.trim() ? body.topicId.trim() : null;
    let stage = "draft";
    let finalTitle = title;
    let selectedTopic: string | null = null;
    let cardId: string | null = typeof body?.cardId === "string" && body.cardId ? body.cardId : null;
    let claimSnapshot: string | null = null;

    // 1. 如果传入了 claimSnapshot（来自卡片或选题）
    const snap = body?.claimSnapshot;
    if (snap && typeof snap.claim === "string" && snap.claim.trim()) {
      const finalClaim = snap.claim.trim();
      claimSnapshot = JSON.stringify({
        claim: finalClaim,
        noteTitle: typeof snap.noteTitle === "string" ? snap.noteTitle.slice(0, 120) : null,
        boundary: typeof snap.boundary === "string" && snap.boundary.trim() ? snap.boundary.trim().slice(0, 300) : null,
        cut: typeof snap.cut === "string" && snap.cut.trim() ? snap.cut.trim().slice(0, 200) : null,
        confidence: typeof snap.confidence === "string" && snap.confidence.trim() ? snap.confidence.trim().slice(0, 60) : null,
      });
    }

    // 2. 如果传入了 cardId，提取卡片关联的源笔记自动挂载
    if (cardId) {
      const card = db
        .prepare("SELECT document_id FROM knowledge_cards WHERE id = ?")
        .get(cardId) as { document_id: string } | undefined;
      if (card?.document_id && !itemIds.includes(card.document_id)) {
        itemIds.push(card.document_id);
      }
    }

    // 3. 如果传入了 selectedTopic
    if (body?.selectedTopic && typeof body.selectedTopic === "object") {
      selectedTopic = JSON.stringify({
        title: body.selectedTopic.title || finalTitle,
        angle: body.selectedTopic.angle || "",
        hook: body.selectedTopic.hook || "",
        outline: Array.isArray(body.selectedTopic.outline) ? body.selectedTopic.outline : [],
      });
    } else if (snap) {
      selectedTopic = JSON.stringify({
        title: finalTitle,
        angle: snap.cut || snap.claim || "核心立论",
        outline: [],
      });
    }

    // 闪念成稿快速通道：以首条素材为骨架直接落位起草工位
    if (body?.quickDraft === true && itemIds.length > 0) {
      const note = db
        .prepare("SELECT title FROM knowledge_items WHERE id = ?")
        .get(itemIds[0]) as { title: string | null } | undefined;
      if (note) {
        stage = "draft";
        finalTitle = (note.title || "闪念速写").slice(0, 60);
        selectedTopic = JSON.stringify({
          title: finalTitle,
          angle: "闪念成稿：以该素材为骨架直接起草",
          outline: [],
        });
      }
    }

    db.prepare(
      "INSERT INTO pipeline_projects (id, title, current_stage, target_skill, topic_id, selected_topic, master_content, card_id, claim_snapshot) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)"
    ).run(id, finalTitle, stage, targetSkill, topicId, selectedTopic, cardId, claimSnapshot);

    if (itemIds.length > 0) {
      attachMaterialsToProject(id, itemIds, "manual");
    }

    const created = getProjectById(id);
    return NextResponse.json({ project: created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("POST /api/projects error:", message);
    return NextResponse.json({ error: `创建项目失败: ${message}` }, { status: 500 });
  }
}
