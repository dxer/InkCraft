"use client";

import { Check, FileSearch, Loader2, Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PipelineProject } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkshopToast } from "./toast";

interface GatherStageProps {
  project: PipelineProject;
  onProjectUpdate: (project: PipelineProject) => void;
}

interface RetrieveHit {
  chunkId: string;
  noteId: string;
  noteTitle: string;
  preview: string;
  reason: string;
  score: number;
  isSourceNote: boolean;
  selected: boolean;
}

const MAX_CHUNKS = 8;
const CHAR_BUDGET = 1200; // 装箱目标 8 条 × 约 150 字

/** 默认检索词：卡片主张（或选定命题），服务端会自动加权零件短引与源笔记 */
function defaultQuery(project: PipelineProject): string {
  if (project.claimSnapshot) {
    return project.claimSnapshot.claim;
  }
  return project.selectedTopic?.title || project.title;
}

/** 工位·取证：召回切片 → 勾选 → 装箱预算，产出素材包 */
export function GatherStage({ project, onProjectUpdate }: GatherStageProps) {
  const toast = useWorkshopToast();

  const [query, setQuery] = useState(defaultQuery(project));
  const [hits, setHits] = useState<RetrieveHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(project.chunkSelection?.map((c) => c.chunkId) || [])
  );
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const searchedForRef = useRef<string | null>(null);

  async function runSearch(q: string) {
    if (loading || !q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/workshop/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "检索失败");
      setHits(data.hits || []);
      setExpanded(false);

      // 预勾规则：源笔记命中、短引命中
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const h of data.hits || []) {
          if ((h.reason === "源笔记" || h.reason === "短引命中") && next.size < MAX_CHUNKS) {
            next.add(h.chunkId);
          }
        }
        return next;
      });
      setSearched(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "检索失败，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  }

  // 进入工位自动检索一次
  useEffect(() => {
    const key = `${project.id}:${defaultQuery(project)}`;
    if (searchedForRef.current === key) return;
    searchedForRef.current = key;
    void runSearch(defaultQuery(project));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function persistSelection(next: Set<string>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setChunks: Array.from(next).map((chunkId) => ({ chunkId })),
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast("保存勾选失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }

  function toggle(chunkId: string) {
    setSelectedIds((prev) => {
      if (prev.has(chunkId)) {
        const next = new Set(prev);
        next.delete(chunkId);
        void persistSelection(next);
        return next;
      }
      if (prev.size >= MAX_CHUNKS) {
        toast(`最多勾选 ${MAX_CHUNKS} 条，请先取消一条`, "error");
        return prev;
      }
      const next = new Set(prev);
      next.add(chunkId);
      void persistSelection(next);
      return next;
    });
  }

  async function advanceToDraft() {
    if (advancing) return;
    if (selectedIds.size === 0) {
      toast("至少选一条切片，或标记缺证据并写短稿", "error");
      return;
    }
    setAdvancing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStage: "draft" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast(`素材包已装箱（${selectedIds.size} 条），进入起草`, "success");
      onProjectUpdate(data.project);
    } catch {
      toast("进入起草失败，请稍后重试", "error");
    } finally {
      setAdvancing(false);
    }
  }

  const selectedHits = hits.filter((h) => selectedIds.has(h.chunkId));
  // 勾选但不在当前结果里的（上一次勾选），也要计入预算
  const missingSelected = (project.chunkSelection || []).filter(
    (c) => !hits.some((h) => h.chunkId === c.chunkId)
  );
  const estChars =
    [...selectedHits.map((h) => Math.min(h.preview.length, 150)),
     ...missingSelected.map(() => 150)].reduce((a, b) => a + b, 0);
  const budgetPct = Math.min(100, Math.round((estChars / CHAR_BUDGET) * 100));
  const budgetFull = selectedIds.size >= MAX_CHUNKS;
  const visible = expanded ? hits : hits.slice(0, 12);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      {/* 顶：检索条 + 预算 */}
      <div className="space-y-2 border-b bg-card px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="relative max-w-2xl flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="取证检索词"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch(query);
              }}
              placeholder="检索词 = 主张 + 零件短引，可自行修改"
              className="rounded-md pl-9 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-md text-xs"
            disabled={loading || !query.trim()}
            onClick={() => void runSearch(query)}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <FileSearch className="size-3.5" />}
            检索
          </Button>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            已选 <span className="font-semibold text-foreground">{selectedIds.size}</span>/{MAX_CHUNKS} 条
          </span>
          <div className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", budgetFull ? "bg-destructive" : "bg-primary/70")}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <span className={cn(budgetFull && "font-medium text-destructive")}>
            约 {estChars}/{CHAR_BUDGET} 字{budgetFull ? " · 预算已满，先取消一条" : ""}
          </span>
          {saving && <span>保存中…</span>}
        </div>
      </div>

      {/* 中：候选切片列表 */}
      <div className="min-h-0 overflow-y-auto px-5 py-4">
        {!searched && !loading && (
          <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
            输入检索词开始取证
          </div>
        )}
        {loading && (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        )}
        {searched && !loading && hits.length === 0 && (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm font-medium">未检索到相关笔记原料</p>
            <p className="mt-1 text-xs text-muted-foreground">换个说法重试，或缩短检索关键词。</p>
          </div>
        )}
        {hits.length > 0 && (
          <div className="space-y-2">
            {visible.map((h) => {
              const checked = selectedIds.has(h.chunkId);
              const disabled = !checked && budgetFull;
              return (
                <label
                  key={h.chunkId}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3.5 transition-all hover:border-primary/40",
                    checked && "border-primary/50 bg-primary/[0.04]",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(h.chunkId)}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">
                        《{h.noteTitle}》
                      </span>
                      <Badge variant="secondary" className="h-4.5 shrink-0 rounded px-1.5 text-[10px] font-normal">
                        {h.reason}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {h.preview}
                    </p>
                  </div>
                </label>
              );
            })}
            {hits.length > 12 && (
              <div className="pt-1 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 rounded-md text-xs text-muted-foreground"
                  onClick={() => setExpanded(!expanded)}
                >
                  <Plus className="size-3.5" />
                  {expanded ? "收起" : `加载更多（还有 ${hits.length - 12} 条）`}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底：进入起草 */}
      <div className="flex items-center justify-between border-t bg-card px-5 py-3">
        <span className="text-[11px] text-muted-foreground">
          {selectedIds.size === 0
            ? "至少选一条切片，才能进入起草"
            : `素材包 ${selectedIds.size} 条，起草时将按 [S1]…[S${selectedIds.size}] 注入`}
        </span>
        <Button
          size="sm"
          className="gap-1.5 rounded-md text-xs font-semibold"
          disabled={selectedIds.size === 0 || advancing}
          onClick={() => void advanceToDraft()}
        >
          {advancing ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          进入起草
        </Button>
      </div>
    </div>
  );
}
