"use client";

import {
  ArrowRight,
  Brain,
  ChevronDown,
  Layers,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { VoiceProfile } from "@/app/api/voices/route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import type { PipelineProject } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWorkshopToast } from "./toast";
import { MockNotice } from "./mock-notice";

interface MemoryItem {
  id: string;
  title: string;
  excerpt: string;
}

interface DraftStageProps {
  project: PipelineProject;
  canvasContent: string;
  onContentChange: (content: string) => void;
  onDraftComplete: (content: string) => void;
  onGoReview: () => void;
}

/** 工步② 起草：白纸画布 + 文风档案与记忆联想真实注入的流式起草 */
export function DraftStage({
  project,
  canvasContent,
  onContentChange,
  onDraftComplete,
  onGoReview,
}: DraftStageProps) {
  const toast = useWorkshopToast();

  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("none");
  const [drafting, setDrafting] = useState(false);

  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const [railOpen, setRailOpen] = useState(true);
  const [draftMock, setDraftMock] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const topic = project.selectedTopic;
  const materials = project.materials || [];

  useEffect(() => {
    fetch("/api/voices")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setVoices(data?.voices || []))
      .catch(() => {});
  }, []);

  // 记忆联想预览（真实条数与出处）
  useEffect(() => {
    if (!topic?.title) return;
    fetch("/api/pipeline/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        query: `${topic.title} ${topic.angle || ""}`,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMemories(data?.memories || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, topic?.title]);

  async function runDraft() {
    if (!topic || drafting) return;
    setDrafting(true);
    onContentChange("");

    try {
      const res = await fetch("/api/pipeline/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          voiceProfileId:
            selectedVoiceId !== "none" ? selectedVoiceId : undefined,
        }),
      });

      if (!res.ok || !res.body) throw new Error();
      setDraftMock(res.headers.get("X-Is-Mock") === "true");

      const usedCount = Number(res.headers.get("X-Memory-Count"));
      if (!Number.isNaN(usedCount) && memories.length !== usedCount) {
        // 起草实际注入的记忆数与预览可能不同（排除素材后重算），以响应头为准
        setMemories((prev) => prev.slice(0, usedCount));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        onContentChange(fullText);
      }
      onDraftComplete(fullText);
      toast("母稿起草完成，可划词推敲继续打磨", "success");
    } catch {
      toast("起草失败，请检查模型配置后重试", "error");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 控制条 */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-card/30 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
            <SelectTrigger className="h-8 w-44 rounded-md text-xs">
              <SelectValue placeholder="文风语调" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">默认严谨客观风</SelectItem>
              {voices.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                  {v.isDefault ? "（默认）" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            onClick={() => setMemoryOpen((v) => !v)}
            className={cn(
              "relative flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
              memories.length > 0
                ? "border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10"
                : "text-muted-foreground/60",
            )}
          >
            <Brain
              className={cn("size-3.5", memories.length > 0 && "text-primary")}
            />
            {memories.length > 0
              ? `已联想 ${memories.length} 条创作记忆`
              : "暂无相关记忆"}
            {memories.length > 0 && (
              <ChevronDown
                className={cn(
                  "size-3 transition-transform",
                  memoryOpen && "rotate-180",
                )}
              />
            )}
          </button>

          <Button
            onClick={runDraft}
            disabled={drafting || !topic}
            size="sm"
            className="h-8 gap-1.5 rounded-md text-xs font-medium shadow-xs"
          >
            {drafting ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                陈执笔流式起草中...
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                {canvasContent ? "重新起草母稿" : "启动起草"}
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRailOpen((v) => !v)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
              railOpen
                ? "border-foreground/20 bg-muted/50 text-foreground"
                : "text-muted-foreground hover:bg-muted/40",
            )}
          >
            <Layers className="size-3.5" />
            选题与素材
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {canvasContent ? `${canvasContent.length} 字` : "空白"}
          </span>
          <Button
            onClick={onGoReview}
            disabled={!canvasContent.trim()}
            size="sm"
            className="h-8 gap-1.5 rounded-md bg-foreground text-xs font-semibold text-background shadow-xs hover:bg-foreground/90"
          >
            初稿就绪，进入编审
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 记忆联想展开 */}
      {memoryOpen && memories.length > 0 && (
        <div className="shrink-0 border-b bg-primary/[0.03] px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {memories.map((m) => (
              <div
                key={m.id}
                className="max-w-72 rounded-lg border bg-card px-2.5 py-1.5 text-[11px] leading-relaxed"
                title={m.excerpt}
              >
                <span className="font-medium text-foreground">{m.title}</span>
                <span className="ml-1.5 text-muted-foreground line-clamp-1 inline">
                  {m.excerpt}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            以上为按选题召回的创作者历史速记，起草时将自然融入行文（非素材，不占论据清单）。
          </p>
        </div>
      )}

      {draftMock && <MockNotice label="当前母稿为演示数据" />}

      <div className="flex min-h-0 flex-1">
        {/* 白纸画布 */}
        <div
          ref={editorRef}
          className="min-w-0 flex-1 overflow-y-auto px-6 py-6"
        >
          <div className="mx-auto max-w-3xl">
            <MarkdownEditor
              content={canvasContent}
              onChange={onContentChange}
              minHeight="62vh"
              placeholder="陈执笔尚未落笔。点击上方「启动起草」生成母稿，或直接在此白纸开写……"
            />
          </div>
        </div>

        {/* 选题与素材参考栏 */}
        {railOpen && (
          <aside className="w-80 shrink-0 space-y-4 overflow-y-auto border-l bg-muted/20 p-4">
            {topic && (
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <PenLine className="size-3" />
                  选题命题
                </div>
                <h3 className="mt-1.5 text-sm font-semibold leading-snug">
                  {topic.title}
                </h3>
                {topic.angle && (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {topic.angle}
                  </p>
                )}
                {topic.outline && topic.outline.length > 0 && (
                  <ol className="mt-3 space-y-1.5 border-t pt-3">
                    {topic.outline.map((sec, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-xs text-foreground/85"
                      >
                        <span className="tabular-nums text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {sec}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <Layers className="size-3" />
                挂载素材（{materials.length}）
              </div>
              {materials.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  本篇未挂载论据素材。
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {materials.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border bg-background p-2.5"
                    >
                      <div className="truncate text-xs font-medium text-foreground">
                        {m.title || "未命名笔记"}
                      </div>
                      <div className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                        {m.content}
                      </div>
                      <Badge
                        variant="outline"
                        className="mt-1.5 text-[9px] font-normal text-muted-foreground"
                      >
                        {m.source === "evidence" ? "论据挂载" : "手动挂载"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
