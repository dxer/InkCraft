"use client";

import { Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TopicBrief } from "@/lib/types";
import type { PipelineProject } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MockNotice } from "./mock-notice";
import { useWorkshopToast } from "./toast";

interface TopicStageProps {
  project: PipelineProject;
  onProjectUpdate: (project: PipelineProject) => void;
}

const EMPTY_BRIEF: TopicBrief = { audience: "", acceptance: "", intent: "", avoid: "" };

/** 工位·锁题：把主张/命题压成四行题旨（给谁看 / 要接受的一句话 / 开篇意图 / 不写什么） */
export function TopicStage({ project, onProjectUpdate }: TopicStageProps) {
  const toast = useWorkshopToast();

  const [draft, setDraft] = useState<TopicBrief>(project.brief || EMPTY_BRIEF);
  const [generated, setGenerated] = useState<TopicBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [adopting, setAdopting] = useState(false);
  const [isMock, setIsMock] = useState(false);

  const snap = project.claimSnapshot;
  const topic = project.selectedTopic;

  async function generate() {
    if (loading) return;
    setLoading(true);
    setGenerated(null);
    try {
      const res = await fetch("/api/pipeline/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "锁题失败");
      setGenerated(data.brief);
      setIsMock(!!data.isMock);
    } catch (err) {
      toast(err instanceof Error ? err.message : "锁题失败，请稍后重试", "error");
    } finally {
      setLoading(false);
    }
  }

  async function adopt(brief: TopicBrief) {
    if (adopting) return;
    setAdopting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, currentStage: "gather" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast("题旨已定，进入取证", "success");
      onProjectUpdate(data.project);
    } catch {
      toast("保存题旨失败，请稍后重试", "error");
    } finally {
      setAdopting(false);
    }
  }

  async function saveAndContinue() {
    const next: TopicBrief = {
      audience: draft.audience.trim(),
      acceptance: draft.acceptance.trim(),
      intent: draft.intent.trim(),
      avoid: draft.avoid.trim(),
    };
    if (!next.acceptance) {
      toast("「要接受的那句话」不能为空", "error");
      return;
    }
    await adopt(next);
  }

  const briefRows: { key: keyof TopicBrief; label: string; hint: string; long?: boolean }[] = [
    { key: "audience", label: "给谁看", hint: "一类具体的人，不超过 20 字" },
    { key: "acceptance", label: "要接受的那句话", hint: "读者读完必须记住并认同的判断，不超过 30 字", long: true },
    { key: "intent", label: "开篇意图", hint: "第一段怎么抓住读者（冲突 / 反转 / 场景 / 提问）", long: true },
    { key: "avoid", label: "不写什么", hint: "为防跑题明确排除的内容，用顿号连接", long: true },
  ];

  return (
    <div className="grid h-full min-h-0 gap-4 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
      {/* 中栏：四行题旨表单 */}
      <div className="flex min-h-0 flex-col rounded-xl border bg-card">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-sm font-semibold">锁题 · 四行题旨</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            题旨是取证与起草的合同：四行定完，后面每一步只服务它。
          </p>
        </div>

        {/* 来源：卡片快照或已选定命题 */}
        <div className="border-b bg-muted/30 px-5 py-3">
          {snap ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
                <Sparkles className="size-3" />
                卡片快照 · 《{snap.noteTitle || "未命名笔记"}》
              </div>
              <p className="font-medium leading-relaxed text-foreground">{snap.claim}</p>
              {snap.boundary && <p className="leading-relaxed text-muted-foreground">边界：{snap.boundary}</p>}
              {(snap.cut || snap.confidence) && (
                <p className="leading-relaxed text-muted-foreground">
                  {snap.cut ? `切口：${snap.cut}` : ""}
                  {snap.cut && snap.confidence ? " · " : ""}
                  {snap.confidence ? `信度：${snap.confidence}` : ""}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
                <Sparkles className="size-3" />
                已选定命题
              </div>
              <p className="font-medium leading-relaxed text-foreground">
                {topic?.title || project.title}
              </p>
              {topic?.angle && <p className="leading-relaxed text-muted-foreground">{topic.angle}</p>}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {briefRows.map((row) => (
            <div key={row.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={`brief-${row.key}`} className="text-xs font-medium">
                  {row.label}
                </Label>
                <span className="text-[11px] text-muted-foreground">{row.hint}</span>
              </div>
              {row.long ? (
                <Textarea
                  id={`brief-${row.key}`}
                  rows={2}
                  value={draft[row.key]}
                  onChange={(e) => setDraft({ ...draft, [row.key]: e.target.value })}
                  className="min-h-0 resize-none rounded-md text-sm leading-relaxed"
                />
              ) : (
                <Input
                  id={`brief-${row.key}`}
                  value={draft[row.key]}
                  onChange={(e) => setDraft({ ...draft, [row.key]: e.target.value })}
                  className="rounded-md text-sm"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t px-5 py-3">
          <span className="text-[11px] text-muted-foreground">
            {draft.acceptance.trim() ? "题旨可用了" : "至少填「要接受的那句话」"}
          </span>
          <Button
            size="sm"
            className="gap-1.5 rounded-md text-xs font-semibold"
            disabled={!draft.acceptance.trim() || adopting}
            onClick={() => void saveAndContinue()}
          >
            {adopting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            采用并进入取证
          </Button>
        </div>
      </div>

      {/* 右栏：锁题师 AI */}
      <div className="flex min-h-0 flex-col rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5 text-primary" />
            锁题师 · 定调
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-md px-2 text-xs"
            disabled={loading}
            onClick={() => void generate()}
          >
            {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            {generated ? "重新生成" : "生成题旨"}
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {isMock && (
            <MockNotice label="未配置模型，当前为示意题旨" />
          )}
          {!generated && !loading && (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
              让锁题师根据{snap ? "卡片主张" : "选定命题"}产出四行题旨，
              <br />
              也可以直接在左侧手写。
            </div>
          )}
          {loading && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/50" />
              ))}
            </div>
          )}
          {generated && (
            <div className="space-y-2">
              {briefRows.map((row) => (
                <div key={row.key} className={cn("rounded-lg bg-muted/40 px-3 py-2")}>
                  <div className="text-[11px] font-medium text-muted-foreground">{row.label}</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-foreground">
                    {generated[row.key] || "随取证补充"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {generated && (
          <div className="border-t px-4 py-3">
            <Button
              size="sm"
              className="w-full gap-1.5 rounded-md text-xs font-semibold"
              disabled={adopting}
              onClick={() => void adopt(generated)}
            >
              {adopting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              采用这份题旨，进入取证
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
