"use client";

import {
  ArrowRight,
  Bookmark,
  Check,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EvidenceItem } from "@/app/api/pipeline/evidence/route";
import type { TopicOption } from "@/app/api/pipeline/topic/route";
import type { MinedInsightItem } from "@/lib/claims";
import type { PipelineProject } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkshopToast } from "./toast";
import { MockNotice } from "./mock-notice";

interface ChecklistItem {
  itemId: string;
  title: string;
  excerpt: string;
  reason?: string;
  mounted?: boolean;
}

type TopicLike = { title: string; angle?: string; outline?: string[] };

interface IdeateStageProps {
  project: PipelineProject;
  onProjectUpdate: (project: PipelineProject) => void;
}

/** 工步① 构思：选题候选与推荐论据在同一屏合并锁定，确认后进入起草 */
export function IdeateStage({ project, onProjectUpdate }: IdeateStageProps) {
  const toast = useWorkshopToast();

  const [direction, setDirection] = useState("");
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicMock, setTopicMock] = useState(false);
  const [evidenceMock, setEvidenceMock] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  // 推荐论据清单（选题候选展开 / 种子选题锁定时自动检索）
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const fetchedForRef = useRef<string | null>(null);

  // 淘金弹窗
  const [miningOpen, setMiningOpen] = useState(false);
  const [minedInsights, setMinedInsights] = useState<MinedInsightItem[]>([]);
  const [loadingMining, setLoadingMining] = useState(false);

  const lockedTopic = project.selectedTopic;
  const mountedMaterials = project.materials || [];

  // 已锁定选题（种子带入或回退重入）：自动检索补充推荐论据
  useEffect(() => {
    if (!lockedTopic) return;
    const key = lockedTopic.title;
    if (fetchedForRef.current === key) return;
    fetchedForRef.current = key;
    fetchChecklist(lockedTopic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedTopic?.title]);

  function mergeChecklist(evidence: EvidenceItem[]): {
    items: ChecklistItem[];
    checked: Set<string>;
  } {
    const items: ChecklistItem[] = mountedMaterials.map((m) => ({
      itemId: m.itemId,
      title: m.title || "未命名笔记",
      excerpt: m.content.slice(0, 140),
      mounted: true,
    }));
    const seen = new Set(items.map((i) => i.itemId));
    for (const e of evidence) {
      // 过滤 mock 占位条目（itemId 无效）与重复素材
      if (!e.itemId || e.itemId === "none" || seen.has(e.itemId)) continue;
      seen.add(e.itemId);
      items.push({
        itemId: e.itemId,
        title: e.title,
        excerpt: e.excerpt,
        reason: e.reason,
      });
    }
    return { items, checked: new Set(items.map((i) => i.itemId)) };
  }

  async function fetchChecklist(topic: TopicLike) {
    setLoadingEvidence(true);
    try {
      const res = await fetch("/api/pipeline/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, selectedTopic: topic }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const { items, checked } = mergeChecklist(data.evidence || []);
      setChecklist(items);
      setCheckedIds(checked);
      setEvidenceMock(data.isMock === true);
    } catch {
      toast("论据检索失败，请稍后重试", "error");
    } finally {
      setLoadingEvidence(false);
    }
  }

  async function generateTopics() {
    setLoadingTopics(true);
    try {
      const res = await fetch("/api/pipeline/topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          promptDirection: direction,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTopics(data.topics || []);
      setTopicMock(data.isMock === true);
      setSelectedIdx(null);
      setChecklist([]);
      fetchedForRef.current = null;
      if (!data.topics?.length)
        toast("未能提炼出候选选题，可补充方向描述后重试", "info");
    } catch {
      toast("选题提炼失败，请稍后重试", "error");
    } finally {
      setLoadingTopics(false);
    }
  }

  function selectCandidate(idx: number) {
    if (selectedIdx === idx) return;
    setSelectedIdx(idx);
    setChecklist([]);
    setCheckedIds(new Set());
    fetchedForRef.current = null;
    fetchChecklist(topics[idx]);
  }

  // 锁定命题，进入锁题工位（四行题旨定调后再取证、起草）
  async function confirmIdeation(topic: TopicLike, ids: string[]) {
    if (confirming) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topic.title,
          selectedTopic: topic,
          currentStage: "topic",
          clearMaterialSource: "evidence",
          addMaterials: ids,
          materialSource: "evidence",
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast("命题已锁定，进入锁题", "success");
      onProjectUpdate(data.project);
    } catch {
      toast("锁定命题失败，请稍后重试", "error");
    } finally {
      setConfirming(false);
    }
  }

  // 重新构思：清空已锁定选题与论据挂载
  async function resetIdeation() {
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `新装配项目 · ${new Date().toLocaleDateString("zh-CN")}`,
          selectedTopic: null,
          clearMaterialSource: "evidence",
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTopics([]);
      setSelectedIdx(null);
      setChecklist([]);
      setCheckedIds(new Set());
      fetchedForRef.current = null;
      onProjectUpdate(data.project);
    } catch {
      toast("重置失败，请稍后重试", "error");
    }
  }

  // ---- 淘金 ----
  async function openMiningDialog() {
    setMiningOpen(true);
    setLoadingMining(true);
    try {
      const res = await fetch("/api/insights/mined");
      if (res.ok) {
        const data = await res.json();
        setMinedInsights(data.insights || []);
      }
    } finally {
      setLoadingMining(false);
    }
  }

  async function retriggerMining() {
    setLoadingMining(true);
    try {
      const res = await fetch("/api/insights/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setMinedInsights(data.insights || []);
      } else {
        toast("淘金失败，请稍后重试", "error");
      }
    } finally {
      setLoadingMining(false);
    }
  }

  // 选用淘金洞察：作为种子选题锁定，停留本屏待确认
  async function applyMinedInsight(insight: MinedInsightItem) {
    const docIds = (insight.sources || [])
      .map((s) => s.documentId)
      .filter(Boolean);
    const converted: TopicOption = {
      title: insight.title,
      angle: insight.description,
      outline: [
        "引子：核心矛盾与思想张力呈现",
        "解构：对立视角的底层假设与适用边界",
        "重塑：超越二元对立的实践路径与深层洞见",
      ],
    };
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: converted.title,
          selectedTopic: converted,
          addMaterials: docIds,
          materialSource: "evidence",
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMiningOpen(false);
      setTopics([]);
      setSelectedIdx(null);
      setChecklist([]);
      fetchedForRef.current = null;
      toast("已带入淘金命题与出处素材，确认论据后进入起草", "success");
      onProjectUpdate(data.project);
    } catch {
      toast("带入淘金命题失败", "error");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      {/* 已锁定选题（种子带入 / 回退重入） */}
      {lockedTopic ? (
        <>
          <div className="text-center">
            <Badge
              variant="outline"
              className="mb-3 gap-1 text-[10px] text-primary"
            >
              <Sparkles className="size-3" />
              已带入选题
            </Badge>
            <h1 className="text-2xl font-bold leading-snug tracking-tight">
              {lockedTopic.title}
            </h1>
            {lockedTopic.angle && (
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {lockedTopic.angle}
              </p>
            )}
          </div>

          {lockedTopic.outline && lockedTopic.outline.length > 0 && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="text-xs font-medium text-muted-foreground">
                章节骨架
              </div>
              <ol className="mt-2 space-y-1.5">
                {lockedTopic.outline.map((sec, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/90">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {sec}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {evidenceMock && <MockNotice label="论据匹配为演示结果" />}

          <EvidenceChecklistPanel
            items={checklist}
            checkedIds={checkedIds}
            setCheckedIds={setCheckedIds}
            loading={loadingEvidence}
          />

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetIdeation}
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <RotateCcw className="size-3.5" />
              重新构思
            </Button>
            <Button
              onClick={() =>
                confirmIdeation(lockedTopic, Array.from(checkedIds))
              }
              disabled={confirming || loadingEvidence}
              className="gap-1.5 rounded-md px-5 font-semibold shadow-xs"
            >
              {confirming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              锁定命题，进入锁题
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* 初始创作台 */}
          <div className="pt-6 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border bg-card shadow-xs">
              <Zap className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              今天想创作什么？
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              描述一个方向，从知识库提炼候选命题并自动匹配论据；或从淘金洞察、智鉴发芽直接带入。
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              aria-label="创作方向"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !loadingTopics && generateTopics()
              }
              placeholder="输入期望方向（如：批判死记笔记、强调工序装配）"
              className="h-10 rounded-lg text-sm"
            />
            <Button
              onClick={generateTopics}
              disabled={loadingTopics}
              className="h-10 gap-1.5 rounded-lg px-4 text-sm font-medium shadow-xs"
            >
              {loadingTopics ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  提炼中...
                </>
              ) : (
                <>
                  <Zap className="size-4" />
                  提炼选题
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={openMiningDialog}
              className="gap-1.5 rounded-lg border-dashed border-amber-500/40 bg-amber-500/5 text-xs font-medium text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
            >
              <Sparkles className="size-3.5 text-amber-500" />
              从知识库智能淘金
            </Button>
          </div>

          {mountedMaterials.length > 0 && (
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Layers className="size-3.5" />
                已挂载 {mountedMaterials.length}{" "}
                篇知识库原料，将作为选题与论据的检索底料
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mountedMaterials.slice(0, 6).map((m) => (
                  <Badge
                    key={m.id}
                    variant="secondary"
                    className="max-w-56 truncate text-[10px] font-normal"
                  >
                    {m.title || "未命名笔记"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 候选命题卡 */}
          {topics.length > 0 && (
            <div className="space-y-3 pt-2">
              {topicMock && <MockNotice label="候选命题为演示数据" />}
              <div className="text-center text-xs text-muted-foreground">
                候选命题 · 点选查看推荐论据
              </div>
              {topics.map((t, idx) => {
                const isActive = selectedIdx === idx;
                return (
                  <Card
                    key={idx}
                    onClick={() => selectCandidate(idx)}
                    className={cn(
                      "cursor-pointer rounded-xl transition-all",
                      isActive
                        ? "border-primary shadow-md"
                        : "border-border/80 hover:border-foreground/30 hover:shadow-sm",
                    )}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold leading-snug">
                            {t.title}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {t.angle}
                          </p>
                        </div>
                        {isActive && (
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        )}
                      </div>

                      {isActive && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          {t.outline && t.outline.length > 0 && (
                            <div>
                              <div className="text-[11px] font-medium text-muted-foreground">
                                章节骨架
                              </div>
                              <ol className="mt-1.5 space-y-1">
                                {t.outline.map((sec, i) => (
                                  <li
                                    key={i}
                                    className="flex gap-2 text-xs text-foreground/90"
                                  >
                                    <span className="tabular-nums text-muted-foreground">
                                      {String(i + 1).padStart(2, "0")}
                                    </span>
                                    {sec}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          <EvidenceChecklistPanel
                            items={checklist}
                            checkedIds={checkedIds}
                            setCheckedIds={setCheckedIds}
                            loading={loadingEvidence}
                          />

                          <div className="flex justify-end">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmIdeation(t, Array.from(checkedIds));
                              }}
                              disabled={confirming || loadingEvidence}
                              className="gap-1.5 rounded-md px-4 text-xs font-semibold shadow-xs"
                            >
                              {confirming ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Check className="size-3.5" />
                              )}
                              锁定命题，进入锁题
                              <ArrowRight className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 智能淘金弹窗 */}
      <Dialog open={miningOpen} onOpenChange={setMiningOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold">
                    从知识库智能淘金
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    系统从笔记微粒中挖掘出的思辨张力与跨界命题，选用将自动挂载原始切片论据。
                  </DialogDescription>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={retriggerMining}
                disabled={loadingMining}
                className="h-7 gap-1.5 text-xs"
              >
                {loadingMining ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                {loadingMining ? "淘金中..." : "重新淘金"}
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto py-2 pr-1">
            {loadingMining && minedInsights.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                <span>正在全库扫描观点微粒与跨界碰撞...</span>
              </div>
            ) : minedInsights.length === 0 ? (
              <div className="space-y-2 rounded-lg border border-dashed py-10 text-center">
                <p className="text-xs text-muted-foreground">
                  暂未挖掘到观点碰撞，可能是笔记数量较少或尚未萃取微粒
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={retriggerMining}
                  className="gap-1 text-xs"
                >
                  <Sparkles className="size-3" />
                  立即触发全库淘金
                </Button>
              </div>
            ) : (
              minedInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {insight.insight_type === "tension"
                            ? "观点张力"
                            : insight.insight_type === "cross_domain"
                              ? "跨界碰撞"
                              : "认知盲区"}
                        </Badge>
                        <h4 className="text-sm font-semibold text-foreground">
                          {insight.title}
                        </h4>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {insight.description}
                      </p>
                    </div>
                  </div>

                  {insight.sources && insight.sources.length > 0 && (
                    <div className="space-y-1.5 rounded-lg border border-border/50 bg-background/80 p-2.5 text-[11px]">
                      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                        <Layers className="size-3" />
                        <span>论据出处</span>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {insight.sources.map((s, idx) => (
                          <div
                            key={idx}
                            className="truncate text-muted-foreground"
                          >
                            • 《{s.documentTitle || "笔记"}》：&ldquo;
                            {s.claimText}&rdquo;
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={() => applyMinedInsight(insight)}
                      className="h-7 gap-1 bg-foreground text-xs font-medium text-background hover:bg-foreground/90"
                    >
                      <Check className="size-3" />
                      选用此命题并挂载素材
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EvidenceChecklistPanel({
  items,
  checkedIds,
  setCheckedIds,
  loading,
}: {
  items: ChecklistItem[];
  checkedIds: Set<string>;
  setCheckedIds: (next: Set<string>) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-xs">正在跨库检索推荐论据，组织论证清单...</span>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">
          论据清单 <Bookmark className="mr-1 inline size-3" />
          已选 {checkedIds.size} / {items.length} 篇，将喂给起草
        </span>
        <div className="flex items-center gap-2">
          {items.some((i) => i.mounted) && (
            <Badge
              variant="outline"
              className="text-[10px] font-normal text-muted-foreground"
            >
              已挂载
            </Badge>
          )}
          <button
            onClick={() =>
              setCheckedIds(
                checkedIds.size === items.length
                  ? new Set()
                  : new Set(items.map((i) => i.itemId)),
              )
            }
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {checkedIds.size === items.length ? "取消全选" : "全选"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const checked = checkedIds.has(item.itemId);
          return (
            <div
              key={item.itemId}
              onClick={() => {
                const next = new Set(checkedIds);
                if (next.has(item.itemId)) next.delete(item.itemId);
                else next.add(item.itemId);
                setCheckedIds(next);
              }}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-xs transition-colors",
                checked
                  ? "border-primary/40 bg-primary/[0.03]"
                  : "border-border/70 opacity-75 hover:opacity-100",
              )}
            >
              <Checkbox checked={checked} className="mt-0.5" />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span className="truncate">{item.title}</span>
                  {item.mounted && (
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-[9px] font-normal"
                    >
                      种子素材
                    </Badge>
                  )}
                </div>
                <div className="line-clamp-2 text-muted-foreground">
                  {item.excerpt}
                </div>
                {item.reason && (
                  <div className="text-[10px] italic text-muted-foreground/80">
                    入选理由：{item.reason}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
