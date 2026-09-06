"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DraftStage } from "@/components/workshop/draft-stage";
import { IdeateStage } from "@/components/workshop/ideate-stage";
import { ReviewStage } from "@/components/workshop/review-stage";
import { SaveToKbDialog } from "@/components/workshop/save-to-kb-dialog";
import { WorkshopToastProvider } from "@/components/workshop/toast";
import { WizardProgress } from "@/components/workshop/wizard-progress";
import type { MinedInsightItem } from "@/lib/claims";
import type { PipelineProject, PipelineStage } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function WorkshopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <WorkshopContent />
    </Suspense>
  );
}

function WorkshopContent() {
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("projectId");
  const fromInsightParam = searchParams.get("fromInsight");

  const [project, setProject] = useState<PipelineProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [canvasContent, setCanvasContent] = useState("");
  const [variants, setVariants] = useState<Record<string, string>>({});

  const [saveToKbOpen, setSaveToKbOpen] = useState(false);
  const [saveToKbInitialPlatform, setSaveToKbInitialPlatform] =
    useState("master");

  const loadedForRef = useRef<string | null>(null);
  const seedHandledRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 最新值 refs：防抖保存读最新内容，避免闭包过期
  const projectIdRef = useRef<string>("");
  const contentRef = useRef("");

  function applyProject(p: PipelineProject, syncCanvas = false) {
    setProject(p);
    setVariants(p.variants || {});
    projectIdRef.current = p.id;
    if (syncCanvas) {
      setCanvasContent(p.masterContent || "");
      contentRef.current = p.masterContent || "";
    }
  }

  // 加载项目：显式 projectId 打开该项目（续作/入口带入），否则一律初始化崭新空白工作台
  const loadProject = useCallback(async () => {
    try {
      const url = projectIdParam
        ? `/api/projects?projectId=${encodeURIComponent(projectIdParam)}`
        : "/api/projects?new=true";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.project) applyProject(data.project, true);
      }
    } finally {
      setLoading(false);
    }
  }, [projectIdParam]);

  useEffect(() => {
    // 按 projectId 参数取值执行一次加载；参数变化（如 projectId → 无）时重新加载
    const loadKey = projectIdParam ?? "";
    if (loadedForRef.current === loadKey) return;
    loadedForRef.current = loadKey;
    loadProject();
  }, [loadProject, projectIdParam]);

  // ---- 持久化 ----

  async function saveContentNow(content: string) {
    const pid = projectIdRef.current;
    if (!pid || content === "") return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${pid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterContent: content }),
      });
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setVariants(data.project.variants || {});
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCanvasChange(md: string) {
    setCanvasContent(md);
    contentRef.current = md;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(
      () => void saveContentNow(contentRef.current),
      800,
    );
  }

  async function patchProject(
    payload: Record<string, unknown>,
  ): Promise<PipelineProject | null> {
    const pid = projectIdRef.current;
    if (!pid) return null;
    const res = await fetch(`/api/projects/${pid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.project;
  }

  // ---- 工步切换（仅允许回退或按流程前进，切换前冲刷未保存正文）----

  async function goToStage(stage: PipelineStage) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (contentRef.current) await saveContentNow(contentRef.current);
    const updated = await patchProject({ currentStage: stage });
    if (updated) {
      // 进入起草工位时同步画布为库中母稿（构思确认/回退重入场景）
      applyProject(updated, stage === "draft");
    }
  }

  function handleProjectUpdate(updated: PipelineProject) {
    applyProject(updated, updated.currentStage === "draft");
  }

  async function applyInsightSeed(insight: MinedInsightItem) {
    const docIds = (insight.sources || [])
      .map((s) => s.documentId)
      .filter(Boolean);
    const updated = await patchProject({
      title: insight.title,
      selectedTopic: {
        title: insight.title,
        angle: insight.description,
        outline: [
          "引子：核心矛盾与思想张力呈现",
          "解构：对立视角的底层假设与适用边界",
          "重塑：超越二元对立的实践路径与深层洞见",
        ],
      },
      addMaterials: docIds,
      materialSource: "evidence",
    });
    if (updated) applyProject(updated);
  }

  // ---- 外部种子（智鉴发芽 / 全库雷达洞察）----

  useEffect(() => {
    if (!project || seedHandledRef.current) return;

    (async () => {
      // 1. 单篇智鉴发芽大纲（materialIds 复数：种子 + 映射素材全量挂载）
      try {
        const rawTopic = sessionStorage.getItem("inkcraft_pending_topic");
        if (rawTopic) {
          const payload = JSON.parse(rawTopic);
          sessionStorage.removeItem("inkcraft_pending_topic");
          if (payload?.topic?.title) {
            const ids = Array.from(
              new Set([
                ...(payload.materialIds || []),
                ...(payload.materialId ? [payload.materialId] : []),
              ]),
            );
            seedHandledRef.current = true;
            const updated = await patchProject({
              title: payload.topic.title,
              selectedTopic: payload.topic,
              addMaterials: ids,
              materialSource: "evidence",
            });
            if (updated) applyProject(updated);
            return;
          }
        }
      } catch {
        // sessionStorage 读取/解析异常：跳过隐藏话题，直接进入下一项
      }

      // 2. 全库雷达张力洞察
      let pending: MinedInsightItem | null = null;
      try {
        const raw = sessionStorage.getItem("inkcraft_pending_insight");
        if (raw) {
          pending = JSON.parse(raw);
          sessionStorage.removeItem("inkcraft_pending_insight");
        }
      } catch {
        // 无有效洞察种子：静默跳过
      }

      if (pending) {
        seedHandledRef.current = true;
        await applyInsightSeed(pending);
      } else if (fromInsightParam) {
        // 新标签页直接带参：按 id 从淘金档案回查
        try {
          const res = await fetch("/api/insights/mined");
          if (res.ok) {
            const data = await res.json();
            const matched = data?.insights?.find(
              (i: MinedInsightItem) => i.id === fromInsightParam,
            );
            if (matched) {
              seedHandledRef.current = true;
              await applyInsightSeed(matched);
            }
          }
        } catch {
          // 洞察劳务查询失败：保持空态即可
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, fromInsightParam]);

  // ---- 顶栏动作 ----

  async function handleTitleChange(title: string) {
    const updated = await patchProject({ title });
    if (updated) applyProject(updated);
  }

  function handleCopyMaster() {
    if (!canvasContent.trim()) return;
    navigator.clipboard.writeText(canvasContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleArchive(initialPlatform: string) {
    setSaveToKbInitialPlatform(initialPlatform);
    setSaveToKbOpen(true);
  }

  async function handleNewProject() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (contentRef.current) await saveContentNow(contentRef.current);
    // 整页回到无参 /workshop：必定初始化崭新空白工作台（router.push 同路由不会重挂载，需整页加载）
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/workshop");
  }

  if (loading || !project) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stage = project.currentStage;
  const scrollStage = stage === "ideate";

  return (
    <WorkshopToastProvider>
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
        <WizardProgress
          project={project}
          saving={saving}
          copied={copied}
          canArchive={!!canvasContent.trim()}
          onTitleChange={handleTitleChange}
          onStageClick={goToStage}
          onArchive={() => handleArchive("master")}
          onCopyMaster={handleCopyMaster}
          onNewProject={handleNewProject}
        />

        <div
          className={cn(
            "min-h-0 flex-1",
            scrollStage ? "overflow-y-auto" : "overflow-hidden",
          )}
        >
          {stage === "ideate" && (
            <IdeateStage
              project={project}
              onProjectUpdate={handleProjectUpdate}
            />
          )}
          {stage === "draft" && (
            <DraftStage
              project={project}
              canvasContent={canvasContent}
              onContentChange={handleCanvasChange}
              onDraftComplete={(content) => void saveContentNow(content)}
              onGoReview={() => void goToStage("review")}
            />
          )}
          {(stage === "review" || stage === "completed") && (
            <ReviewStage
              project={project}
              canvasContent={canvasContent}
              variants={variants}
              onVariantsChange={setVariants}
              onOpenSaveKb={handleArchive}
              onBackToDraft={() => void goToStage("draft")}
              onProjectUpdate={handleProjectUpdate}
            />
          )}
        </div>

        <SaveToKbDialog
          open={saveToKbOpen}
          onOpenChange={setSaveToKbOpen}
          defaultTitle={project.title}
          masterContent={canvasContent}
          variants={variants}
          initialPlatform={saveToKbInitialPlatform}
        />
      </div>
    </WorkshopToastProvider>
  );
}
