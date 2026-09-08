"use client";

import {
  Compass,
  FileText,
  Library,
  MessageSquare,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PlatformBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PLATFORM_SKILLS, type PlatformSkillId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface WorkItem {
  id: string;
  title: string;
  rawTitle?: string;
  currentStage: string;
  targetSkill?: PlatformSkillId | null;
  topicId?: string | null;
  topicTitle?: string | null;
  topicAngle?: string | null;
  wordCount: number;
  updatedAt: string;
  variants: string[];
}

export default function WorksPage() {
  const router = useRouter();
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState<string>("all");
  const [pendingDelete, setPendingDelete] = useState<WorkItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const fetchWorks = useCallback(async () => {
    try {
      const res = await fetch("/api/works");
      if (res.ok) {
        const data = await res.json();
        setWorks(data.works);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorks();
  }, [fetchWorks]);

  async function confirmDeleteWork() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      const res = await fetch(`/api/works/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setWorks((prev) => prev.filter((w) => w.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
  }

  async function createNewAndOpen() {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `装配新作品 · ${new Date().toLocaleDateString("zh-CN")}`,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.project?.id) {
        router.push(`/workshop?projectId=${data.project.id}`);
      }
    }
  }

  const getSkillMeta = (id?: string | null) => {
    return PLATFORM_SKILLS.find((s) => s.id === id) || PLATFORM_SKILLS[0];
  };

  const getSkillIcon = (id?: string | null) => {
    switch (id) {
      case "wechat":
        return <MessageSquare className="size-3 text-emerald-500" />;
      case "xiaohongshu":
        return <Sparkles className="size-3 text-rose-500" />;
      case "zhihu":
        return <Compass className="size-3 text-blue-500" />;
      case "x_thread":
        return <Share2 className="size-3 text-zinc-700 dark:text-zinc-300" />;
      default:
        return <FileText className="size-3 text-purple-500" />;
    }
  };

  const skillCounts: Record<string, number> = {
    all: works.length,
  };
  PLATFORM_SKILLS.forEach((s) => {
    skillCounts[s.id] = works.filter((w) => (w.targetSkill || "wechat") === s.id).length;
  });

  const availableSkills = PLATFORM_SKILLS.filter((s) => (skillCounts[s.id] || 0) > 0);

  const filtered = works
    .filter((w) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const skillName = getSkillMeta(w.targetSkill).name.toLowerCase();
      return (
        w.title.toLowerCase().includes(q) ||
        (w.rawTitle && w.rawTitle.toLowerCase().includes(q)) ||
        skillName.includes(q)
      );
    })
    .filter((w) => {
      if (skillFilter === "all") return true;
      return (w.targetSkill || "wechat") === skillFilter;
    });

  function formatDate(d?: string) {
    if (!d) return "";
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-8 py-6 sm:py-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg sm:text-xl font-semibold tracking-tight">
            <Library className="size-5 text-muted-foreground" />
            作品库
            <span className="text-xs sm:text-sm font-normal text-muted-foreground">
              Works Gallery
            </span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            作品画廊与多平台成果陈列馆，点击直接进入查看、修改与一键复制。
          </p>
        </div>
        <Button
          onClick={createNewAndOpen}
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold rounded-md shadow-xs self-start sm:self-auto"
        >
          <Plus className="size-3.5" />
          创建新作品
        </Button>
      </header>

      {/* 搜索与种类筛选 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="搜索作品标题或种类"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索作品标题或平台种类..."
            className="pl-9 text-xs rounded-md"
          />
        </div>

        {/* 平台种类筛选标签：仅展示库中实际已有内容的种类 */}
        {availableSkills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="按产出种类筛选">
            <button
              type="button"
              onClick={() => setSkillFilter("all")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs tabular-nums transition-colors cursor-pointer",
                skillFilter === "all"
                  ? "border-foreground bg-foreground text-background font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              )}
            >
              全部 ({skillCounts.all || 0})
            </button>
            {availableSkills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => setSkillFilter(skill.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs tabular-nums transition-colors cursor-pointer",
                  skillFilter === skill.id
                    ? "border-foreground bg-foreground text-background font-medium"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                )}
              >
                <span>{skill.name}</span>
                <span className="opacity-80 font-mono">({skillCounts[skill.id] || 0})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border bg-muted/40"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-dashed py-14 text-center">
            <Library className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium">未找到匹配作品</p>
            <p className="mt-1 text-xs text-muted-foreground">
              在工坊选择平台技能完成创作后，作品将自动归档呈现在这里。
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((work) => {
            const skillMeta = getSkillMeta(work.targetSkill);
            return (
              <div key={work.id} className="group relative">
                <Link
                  href={`/works/${work.id}`}
                  className="block focus:outline-none"
                >
                  <Card className="h-full flex flex-col justify-between gap-1.5 rounded-xl border bg-card py-0 transition-all hover:border-foreground/40 hover:shadow-md cursor-pointer">
                    <CardHeader className="px-4 pt-3 pb-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground pr-8">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <FileText className="size-3.5 text-muted-foreground" />
                            {work.wordCount > 0 ? `${work.wordCount} 字` : "草稿中"}
                          </span>

                          {/* 内容种类徽章（替代原 04 起草等阶段标记） */}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-1.5 py-0 text-[10px] font-medium leading-4 border",
                              skillMeta.color
                            )}
                          >
                            {getSkillIcon(work.targetSkill)}
                            <span>{skillMeta.name}</span>
                          </span>
                        </div>

                        <span className="text-[11px] font-mono">{formatDate(work.updatedAt)}</span>
                      </div>

                      <CardTitle className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors mt-1">
                        {work.title}
                      </CardTitle>

                      {work.topicTitle && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-normal truncate">
                          <span className="shrink-0">💡</span>
                          <span className="truncate">选题：{work.topicTitle}</span>
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="px-4 pb-3 pt-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {work.variants.length > 0 ? (
                          work.variants.map((v) => (
                            <PlatformBadge
                              key={v}
                              platform={v}
                              label={`${v} 已派生`}
                            />
                          ))
                        ) : (
                          <span className="rounded border border-dashed px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            未派生其他平台
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <button
                  aria-label="删除作品"
                  title="删除作品"
                  disabled={deleting}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPendingDelete(work);
                  }}
                  className="absolute top-3 right-3 z-10 flex size-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 shadow-xs backdrop-blur transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 disabled:pointer-events-none"
                >
                  <Trash2 className={cn("size-3.5", deleting && "animate-pulse")} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 删除确认弹框 */}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <DialogContent
          className="sm:max-w-sm rounded-xl p-5"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Trash2 className="size-4" />
              </span>
              删除这篇作品？
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              《{pendingDelete?.title || "未命名作品"}》
              <br />
              母稿与所有派生版本都将被移除，关联的知识库笔记不受影响。
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              删除失败，请稍后重试。
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="rounded-md text-xs"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="rounded-md text-xs bg-destructive font-semibold text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => void confirmDeleteWork()}
            >
              {deleting ? "删除中…" : "确认删除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
