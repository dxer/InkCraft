import { NextResponse } from "next/server";
import {
  attachMaterialsToProject,
  clearMaterialsBySource,
  getProjectById,
  removeMaterialFromProject,
  setProjectChunks,
  updateProject,
} from "@/lib/pipeline";
import { normalizePipelineStage } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const project = getProjectById(id);
  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const project = updateProject(id, {
    title: typeof body.title === "string" ? body.title : undefined,
    currentStage: typeof body.currentStage === "string" ? normalizePipelineStage(body.currentStage) : undefined,
    targetSkill: typeof body.targetSkill === "string" ? body.targetSkill : undefined,
    topicId: typeof body.topicId === "string" ? body.topicId : undefined,
    selectedTopic: body.selectedTopic !== undefined ? JSON.stringify(body.selectedTopic) : undefined,
    masterContent: typeof body.masterContent === "string" ? body.masterContent : undefined,
    brief: body.brief !== undefined ? JSON.stringify(body.brief) : undefined,
    claimSnapshot: body.claimSnapshot !== undefined ? JSON.stringify(body.claimSnapshot) : undefined,
    snapshots: body.snapshots !== undefined ? JSON.stringify(body.snapshots) : undefined,
  });

  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  }

  // 先清空指定来源的旧素材（如重新确认论据前清掉旧 evidence 挂载）
  if (body.clearMaterialSource === "manual" || body.clearMaterialSource === "evidence") {
    clearMaterialsBySource(id, body.clearMaterialSource);
  }

  // 附加素材
  if (Array.isArray(body.addMaterials) && body.addMaterials.length > 0) {
    attachMaterialsToProject(id, body.addMaterials, body.materialSource || "manual");
  }

  // 覆盖式保存取证勾选切片（上限 8 条）
  if (Array.isArray(body.setChunks)) {
    setProjectChunks(
      id,
      body.setChunks
        .filter((c: unknown) => c && typeof (c as { chunkId: unknown }).chunkId === "string")
        .map((c: { chunkId: string; packedText?: string }) => ({
          chunkId: c.chunkId,
          packedText: typeof c.packedText === "string" ? c.packedText : null,
        }))
    );
  }

  // 移除素材
  if (typeof body.removeMaterialId === "string") {
    removeMaterialFromProject(id, body.removeMaterialId);
  }

  const updated = getProjectById(id);
  return NextResponse.json({ project: updated });
}
