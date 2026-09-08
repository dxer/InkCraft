"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { IdeatedTopic } from "@/app/api/workshop/ideate/route";
import { TopicInspirationView } from "@/components/workshop/topic-inspiration-view";
import { WorkshopDesk } from "@/components/workshop/workshop-desk";
import { WorkshopToastProvider } from "@/components/workshop/toast";
import type { MinedInsightItem } from "@/lib/claims";
import type { PipelineProject, PlatformSkillId } from "@/lib/types";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("projectId");
  const skillParam = searchParams.get("skill") as PlatformSkillId | null;
  const fromInsightParam = searchParams.get("fromInsight");

  const [project, setProject] = useState<PipelineProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canvasContent, setCanvasContent] = useState("");
  const [showInspiration, setShowInspiration] = useState(false);

  const loadedForRef = useRef<string | null>(null);
  const seedHandledRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const projectIdRef = useRef<string>("");
  const contentRef = useRef("");

  function applyProject(p: PipelineProject, syncCanvas = false) {
    setProject(p);
    projectIdRef.current = p.id;
    if (syncCanvas) {
      setCanvasContent(p.masterContent || "");
      contentRef.current = p.masterContent || "";
    }
  }

  // 加载项目：若 URL 中没有 projectId，且没有卡片等种子，默认呈现智能选题大厅
  const loadProject = useCallback(async () => {
    try {
      if (!projectIdParam && !fromInsightParam) {
        // 直接访问工坊或新建：展示智能选题灵感大厅
        setShowInspiration(true);
        setLoading(false);
        return;
      }

      setShowInspiration(false);
      const url = `/api/projects?projectId=${encodeURIComponent(projectIdParam || "")}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.project) {
          const p = data.project as PipelineProject;
          if (skillParam && p.targetSkill !== skillParam) {
            p.targetSkill = skillParam;
          }
          applyProject(p, true);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [projectIdParam, fromInsightParam, skillParam]);

  useEffect(() => {
    const loadKey = `${projectIdParam ?? ""}_${skillParam ?? ""}_${fromInsightParam ?? ""}`;
    if (loadedForRef.current === loadKey) return;
    loadedForRef.current = loadKey;
    loadProject();
  }, [loadProject, projectIdParam, skillParam, fromInsightParam]);

  // 保存内容
  async function saveContentNow(content: string) {
    const pid = projectIdRef.current;
    if (!pid) return;
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
      800
    );
  }

  async function patchProject(
    payload: Record<string, unknown>
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

  // 从灵感大厅中选中某一选题方案：创建新项目并立即载入画布
  async function handleSelectTopicFromInspiration(topic: IdeatedTopic) {
    setLoading(true);
    try {
      const card = topic.matchedCards?.[0];
      const itemIds = topic.matchedCards && topic.matchedCards.length > 0
        ? topic.matchedCards.map((c) => c.docId).filter(Boolean)
        : [];

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topic.title,
          topicId: topic.id || null,
          targetSkill: topic.targetSkill,
          cardId: card?.id || null,
          itemIds,
          claimSnapshot: {
            claim: topic.angle || card?.claim || topic.title,
            noteTitle: card?.noteTitle || null,
            boundary: "",
            cut: topic.hook || null,
          },
          selectedTopic: {
            title: topic.title,
            angle: topic.angle,
            hook: topic.hook,
            outline: topic.outline,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.project) {
          setShowInspiration(false);
          applyProject(data.project, true);
          router.replace(`/workshop?projectId=${data.project.id}&skill=${topic.targetSkill}`);
          return;
        }
      }
    } catch {}
    setLoading(false);
  }

  // 外部种子接入
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

  useEffect(() => {
    if (!project || seedHandledRef.current) return;

    (async () => {
      // 1. 智鉴发芽大纲
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
              ])
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
      } catch {}

      // 2. 全库雷达张力洞察
      let pending: MinedInsightItem | null = null;
      try {
        const raw = sessionStorage.getItem("inkcraft_pending_insight");
        if (raw) {
          pending = JSON.parse(raw);
          sessionStorage.removeItem("inkcraft_pending_insight");
        }
      } catch {}

      if (pending) {
        seedHandledRef.current = true;
        await applyInsightSeed(pending);
      } else if (fromInsightParam) {
        try {
          const res = await fetch("/api/insights/mined");
          if (res.ok) {
            const data = await res.json();
            const matched = data?.insights?.find(
              (i: MinedInsightItem) => i.id === fromInsightParam
            );
            if (matched) {
              seedHandledRef.current = true;
              await applyInsightSeed(matched);
            }
          }
        } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, fromInsightParam]);

  // 点击新建项目：直接回到灵感大厅
  async function handleNewProject() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (contentRef.current) await saveContentNow(contentRef.current);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/workshop");
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 非卡片进入或点击新建：开屏展示智能选题灵感大厅
  if (showInspiration || !project) {
    return (
      <TopicInspirationView
        onSelectTopic={handleSelectTopicFromInspiration}
      />
    );
  }

  return (
    <WorkshopToastProvider>
      <WorkshopDesk
        project={project}
        canvasContent={canvasContent}
        saving={saving}
        onContentChange={handleCanvasChange}
        onProjectUpdate={applyProject}
        onNewProject={handleNewProject}
        onSaveContentNow={saveContentNow}
      />
    </WorkshopToastProvider>
  );
}
