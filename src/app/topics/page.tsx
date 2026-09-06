"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Flame,
  IdCard,
  Layers,
  Lightbulb,
  Loader2,
  MessageSquare,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TopicStats } from "@/lib/topics";
import { PLATFORM_SKILLS, type PlatformSkillId, type TopicRepositoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicRepositoryItem[]>([]);
  const [stats, setStats] = useState<TopicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mining, setMining] = useState(false);
  const [mineNotice, setMineNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "idea" | "used" | "archived">("all");
  const [skillFilter, setSkillFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "auto" | "manual">("all");
  const [sortBy, setSortBy] = useState<"score" | "created">("score");

  const [pendingDelete, setPendingDelete] = useState<TopicRepositoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const fetchTopics = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (skillFilter !== "all") params.set("targetSkill", skillFilter);
      if (sourceFilter !== "all") params.set("sourceType", sourceFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/topics?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const list: TopicRepositoryItem[] = data.topics || [];
        setTopics(list);
        setStats(data.stats || null);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, skillFilter, sourceFilter, search]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const sortedTopics = [...topics].sort((a, b) => {
    if (sortBy === "score") {
      return (b.score ?? 90) - (a.score ?? 90);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // 手动触发周期增量扫描分析
  async function handleTriggerMining() {
    if (mining) return;
    setMining(true);
    setMineNotice(null);
    try {
      const res = await fetch("/api/topics/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (data.ran) {
        setMineNotice(`扫描完成！发现 ${data.newNotesCount} 篇新笔记，成功挖掘并入库 ${data.savedTopicsCount} 个全新选题`);
      } else {
        setMineNotice(data.reason || "当前无新收录笔记，跳过生成");
      }
      await fetchTopics();
    } catch {
      setMineNotice("扫描执行失败，请稍后重试");
    } finally {
      setMining(false);
    }
  }

  // 切换选题状态（标记已创作 / 待写）
  async function handleToggleStatus(topic: TopicRepositoryItem) {
    const nextStatus = topic.status === "used" ? "idea" : "used";
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setTopics((prev) =>
          prev.map((t) => (t.id === topic.id ? { ...t, status: nextStatus } : t))
        );
        if (stats) {
          setStats({
            ...stats,
            ideas: nextStatus === "used" ? stats.ideas - 1 : stats.ideas + 1,
            used: nextStatus === "used" ? stats.used + 1 : stats.used - 1,
          });
        }
      }
    } catch {}
  }

  // 确认删除选题
  async function confirmDeleteTopic() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/topics/${pendingDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTopics((prev) => prev.filter((t) => t.id !== pendingDelete.id));
        setPendingDelete(null);
      }
    } catch {
    } finally {
      setDeleting(false);
    }
  }

  // 一键用该选题去工坊创作
  async function handleCreateWithTopic(topic: TopicRepositoryItem) {
    setNavigatingId(topic.id);
    try {
      const card = topic.matchedCards?.[0];
      const itemIds = topic.matchedCards && topic.matchedCards.length > 0
        ? topic.matchedCards.map((c) => c.docId).filter(Boolean)
        : topic.sourceNoteIds || [];

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topic.title,
          topicId: topic.id,
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
        router.push(`/workshop?projectId=${data.project.id}&skill=${topic.targetSkill}`);
        return;
      }
    } catch {}
    setNavigatingId(null);
  }

  const getSkillIcon = (id: string) => {
    switch (id) {
      case "wechat":
        return <MessageSquare className="size-3 text-emerald-500 shrink-0" />;
      case "xiaohongshu":
        return <Sparkles className="size-3 text-rose-500 shrink-0" />;
      case "zhihu":
        return <Compass className="size-3 text-blue-500 shrink-0" />;
      case "x_thread":
        return <Share2 className="size-3 text-zinc-700 dark:text-zinc-300 shrink-0" />;
      default:
        return <FileText className="size-3 text-purple-500 shrink-0" />;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 md:p-8">
      {/* 顶部标题与定时挖掘状态区 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-5 text-amber-500" />
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              选题库
            </h1>
            {stats && (
              <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-xs font-semibold">
                {stats.total} 条储备
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            系统每小时自动挖掘新收录笔记并策划全新选题（无新收录则不消耗 Token），不与历史库重复。所有工坊生成的选题亦在此沉淀。
          </p>
        </div>

        {/* 右侧动作区：周期扫描新笔记与触发 */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex flex-col text-right text-[11px] text-muted-foreground">
            <span>
              新入库未分析：
              <strong className={cn("ml-1 font-mono", stats && stats.newNotesSinceLastScan > 0 ? "text-amber-500 font-bold" : "text-foreground")}>
                {stats?.newNotesSinceLastScan ?? 0} 篇
              </strong>
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              {stats?.lastScannedAt ? `上次扫描：${new Date(stats.lastScannedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : "尚未执行扫描"}
            </span>
          </div>

          <Button
            size="sm"
            onClick={handleTriggerMining}
            disabled={mining}
            className="h-8 gap-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
            title="扫描自上次分析后新收录的笔记并生成不重复选题"
          >
            {mining ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Zap className="size-3.5 text-amber-300" />
            )}
            <span>{mining ? "正在扫描新笔记…" : "扫描新笔记生选题"}</span>
          </Button>
        </div>
      </div>

      {/* 扫描反馈提示条 */}
      {mineNotice && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-primary shrink-0" />
            <span>{mineNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setMineNotice(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            关闭
          </button>
        </div>
      )}

      {/* 检索与筛选栏 */}
      <div className="space-y-2.5 rounded-xl bg-card border p-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索选题标题、切角或关键词……"
              className="h-8 pl-8 text-xs rounded-lg bg-background"
            />
          </div>

          {/* 状态筛选 Tab */}
          <div className="flex items-center gap-1 shrink-0 p-0.5 rounded-lg bg-muted/40 border border-border/40">
            {[
              { id: "all", label: "全部" },
              { id: "idea", label: `待创作 (${stats?.ideas ?? 0})` },
              { id: "used", label: `已创作 (${stats?.used ?? 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer",
                  statusFilter === tab.id
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 平台与来源两排细分过滤器 */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/40 text-[11px]">
          {/* 平台筛选 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground font-medium shrink-0">平台:</span>
            <button
              type="button"
              onClick={() => setSkillFilter("all")}
              className={cn(
                "rounded px-2 py-0.5 font-medium transition-colors cursor-pointer",
                skillFilter === "all"
                  ? "bg-foreground text-background font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              全部平台
            </button>
            {PLATFORM_SKILLS.map((s) => {
              const active = skillFilter === s.id;
              const count = stats?.bySkill[s.id] || 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSkillFilter(s.id)}
                  className={cn(
                    "rounded px-2 py-0.5 font-medium transition-colors cursor-pointer border",
                    active
                      ? cn(s.color, "font-semibold shadow-2xs border-current")
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {s.name} ({count})
                </button>
              );
            })}
          </div>

          {/* 来源与排序筛选 */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* 来源筛选 */}
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>来源:</span>
              <button
                type="button"
                onClick={() => setSourceFilter("all")}
                className={cn(
                  "rounded px-1.5 py-0.5 cursor-pointer",
                  sourceFilter === "all" ? "text-foreground font-semibold" : "hover:text-foreground"
                )}
              >
                全部
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => setSourceFilter("auto")}
                className={cn(
                  "rounded px-1.5 py-0.5 cursor-pointer",
                  sourceFilter === "auto" ? "text-foreground font-semibold" : "hover:text-foreground"
                )}
              >
                ⚡ 每小时挖掘
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => setSourceFilter("manual")}
                className={cn(
                  "rounded px-1.5 py-0.5 cursor-pointer",
                  sourceFilter === "manual" ? "text-foreground font-semibold" : "hover:text-foreground"
                )}
              >
                🎨 工坊灵感
              </button>
            </div>

            {/* 排序筛选 */}
            <div className="flex items-center gap-1 text-muted-foreground border-l border-border/40 pl-3">
              <span>排序:</span>
              <button
                type="button"
                onClick={() => setSortBy("score")}
                className={cn(
                  "rounded px-2 py-0.5 cursor-pointer transition-colors font-medium",
                  sortBy === "score"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20"
                    : "hover:text-foreground"
                )}
              >
                🔥 按评分最高
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => setSortBy("created")}
                className={cn(
                  "rounded px-2 py-0.5 cursor-pointer transition-colors font-medium",
                  sortBy === "created"
                    ? "bg-muted text-foreground font-semibold border border-border"
                    : "hover:text-foreground"
                )}
              >
                🕒 按最新创建
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 选题网格 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground space-y-3">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="text-xs font-medium">正在读取选题库……</p>
        </div>
      ) : sortedTopics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed p-6 space-y-3">
          <Lightbulb className="size-10 text-muted-foreground/40" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">暂无符合条件的选题</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              点击上方「扫描新笔记生选题」，或在工坊灵感大厅中碰撞选题，系统将自动入库保存。
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleTriggerMining}
            disabled={mining}
            className="h-8 gap-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <Zap className="size-3.5" />
            <span>立即扫描新笔记</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          {sortedTopics.map((topic) => {
            const skillMeta =
              PLATFORM_SKILLS.find((s) => s.id === topic.targetSkill) || PLATFORM_SKILLS[0];
            const isUsed = topic.status === "used";

            return (
              <Card
                key={topic.id}
                className={cn(
                  "relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md space-y-4",
                  isUsed ? "border-dashed bg-muted/20" : "bg-card"
                )}
              >
                <div className="space-y-3">
                  {/* 顶栏徽章组与状态 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold flex items-center gap-1.5", skillMeta.color)}>
                        {getSkillIcon(topic.targetSkill)}
                        <span>{skillMeta.name}</span>
                      </span>
                      {topic.sourceType === "auto" ? (
                        <span className="rounded-md px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted/80 border border-border/40">
                          ⚡ 周期挖掘
                        </span>
                      ) : (
                        <span className="rounded-md px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted/80 border border-border/40">
                          🎨 工坊生成
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 评分徽章 */}
                      <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 shadow-2xs font-mono">
                        <Flame className="size-3 text-amber-500 shrink-0" />
                        <span>{topic.score || 90}分</span>
                        {topic.scoreTag && (
                          <span className="font-sans font-medium text-[10px] opacity-90 pl-1 border-l border-amber-500/30">
                            {topic.scoreTag.replace(/^[^a-zA-Z\u4e00-\u9fa5]+/, "")}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(topic)}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors cursor-pointer shrink-0 flex items-center gap-1",
                          isUsed
                            ? "border-border bg-muted/80 text-muted-foreground hover:bg-muted"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                        )}
                        title={isUsed ? "点击标记为待创作" : "点击标记为已成稿"}
                      >
                        <span className={cn("size-1.5 rounded-full", isUsed ? "bg-muted-foreground/60" : "bg-emerald-500")} />
                        <span>{isUsed ? "已成稿" : "待创作"}</span>
                      </button>
                    </div>
                  </div>

                  {/* 标题（完整展示，不遮挡不划线） */}
                  <h3 className="text-base font-bold text-foreground leading-snug break-words">
                    {topic.title}
                  </h3>

                  {/* 核心切角（完整展示，不截断） */}
                  {topic.angle && (
                    <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed break-words">
                      <span className="font-semibold text-foreground/90">🎯 核心切角：</span>
                      {topic.angle}
                    </div>
                  )}

                  {/* 破题首句钩子 */}
                  {topic.hook && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2.5 py-0.5 leading-relaxed break-words">
                      “{topic.hook}”
                    </p>
                  )}

                  {/* 论证递进大纲（完整清晰列出） */}
                  {topic.outline && topic.outline.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-semibold text-muted-foreground">论证推进大纲：</div>
                      <ul className="space-y-1 text-xs text-muted-foreground/90 font-mono">
                        {topic.outline.map((item, idx) => (
                          <li key={idx} className="leading-snug break-words">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 关联素材卡片 */}
                  {topic.matchedCards && topic.matchedCards.length > 0 && (
                    <div className="pt-2 border-t border-border/40 space-y-1.5">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <IdCard className="size-3 text-primary" />
                        <span>关联知识库储备 ({topic.matchedCards.length})：</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {topic.matchedCards.map((card, cIdx) => (
                          <span
                            key={cIdx}
                            className="inline-block rounded-md bg-primary/5 border border-primary/15 px-2 py-0.5 text-[11px] text-primary break-all"
                            title={card.claim}
                          >
                            {card.noteTitle ? `《${card.noteTitle}》` : card.claim}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 卡片底栏操作 */}
                <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1 font-mono text-[11px]">
                    <Clock className="size-3" />
                    <span>{topic.createdAt ? new Date(topic.createdAt).toLocaleDateString("zh-CN") : ""}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {topic.usedProjectId && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 px-2.5 text-xs rounded-lg font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        <Link href={`/works/${topic.usedProjectId}`}>
                          <FileText className="size-3.5 mr-1" />
                          <span>产出作品</span>
                        </Link>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(topic)}
                      className="h-8 px-2 text-xs rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="删除该选题"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      <span>删除</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleCreateWithTopic(topic)}
                      disabled={navigatingId === topic.id}
                      className="h-8 px-3.5 rounded-lg text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
                    >
                      {navigatingId === topic.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <PenLine className="size-3.5" />
                      )}
                      <span>去创作</span>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 删除确认弹窗框 */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive">删除选题</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              确认将选题「<strong className="text-foreground">{pendingDelete?.title}</strong>」从选题库中永久移除？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="rounded-md text-xs"
              onClick={() => setPendingDelete(null)}
            >
              取消
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="rounded-md text-xs font-semibold"
              disabled={deleting}
              onClick={confirmDeleteTopic}
            >
              {deleting ? "删除中…" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
