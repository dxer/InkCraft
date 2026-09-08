"use client";

import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Flame,
  GitFork,
  IdCard,
  Info,
  Layers,
  Lightbulb,
  Loader2,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Users,
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
import {
  PLATFORM_SKILLS,
  type PlatformSkillId,
  type TopicRadarAngleType,
  type TopicRepositoryItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const RADAR_ANGLES: Array<{
  id: TopicRadarAngleType | "all";
  label: string;
  sub: string;
  icon: typeof Zap;
  color: string;
}> = [
  {
    id: "all",
    label: "全部灵感",
    sub: "全景视野",
    icon: Sparkles,
    color: "text-amber-500",
  },
  {
    id: "paradox",
    label: "反差碰撞",
    sub: "认知张力 · 突破常识",
    icon: Zap,
    color: "text-rose-500",
  },
  {
    id: "intersection",
    label: "跨界同构",
    sub: "跨领域隐喻 · 深度叙事",
    icon: GitFork,
    color: "text-purple-500",
  },
  {
    id: "deep_dive",
    label: "专题纵深",
    sub: "同维递进 · 系统专栏",
    icon: BookOpen,
    color: "text-blue-500",
  },
];

function formatLastScannedTime(isoString: string | null | undefined): string {
  if (!isoString) return "尚未执行";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "尚未执行";
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    if (isToday) {
      return `今天 ${hours}:${minutes}`;
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return "尚未执行";
  }
}

interface MineNoticeState {
  type: "running" | "success" | "info" | "error";
  title: string;
  message?: string;
}

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicRepositoryItem[]>([]);
  const [stats, setStats] = useState<TopicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mining, setMining] = useState(false);
  const [mineNotice, setMineNotice] = useState<MineNoticeState | null>(null);

  // 筛选与搜索
  const [search, setSearch] = useState("");
  const [activeAngle, setActiveAngle] = useState<TopicRadarAngleType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "idea" | "used" | "archived">("all");
  const [sortBy, setSortBy] = useState<"score" | "created">("score");

  // 创作者自定义选中的备选标题字典：topicId -> selectedTitleIndex (0, 1, 2)
  const [selectedTitles, setSelectedTitles] = useState<Record<string, number>>({});
  // 选题卡片展开/收起详情字典：topicId -> boolean
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const [pendingDelete, setPendingDelete] = useState<TopicRepositoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const fetchTopics = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (activeAngle !== "all") params.set("angleType", activeAngle);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/topics?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const list: TopicRepositoryItem[] = data.topics || [];
        setTopics(list);
        setStats(data.stats || null);
        if (data.stats?.miningState?.isMining) {
          setMining(true);
          setMineNotice({
            type: "running",
            title: "雷达深度策划中",
            message: "正在对知识簇进行高维重组与大纲策划，请稍候…",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, activeAngle, search]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // 轮询后台挖掘状态（防用户切换页面后丢失感知）
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (mining) {
      timer = setInterval(async () => {
        try {
          const res = await fetch("/api/topics/mine");
          if (res.ok) {
            const data = await res.json();
            if (!data.isMining) {
              setMining(false);
              await fetchTopics();
              if (data.lastResult) {
                if (data.lastResult.ran) {
                  setMineNotice({
                    type: "success",
                    title: "选题策划完成",
                    message: `已基于最新知识簇成功策划并入库 ${data.lastResult.savedTopicsCount ?? 1} 个多风格深度成文方案`,
                  });
                } else if (data.lastResult.error) {
                  setMineNotice({
                    type: "error",
                    title: "选题策划中断",
                    message: data.lastResult.error,
                  });
                } else {
                  setMineNotice({
                    type: "info",
                    title: "知识储备已充分挖掘",
                    message:
                      data.lastResult.reason ||
                      "当前知识库中的知识资产已完成最新选题策划。录入新笔记或卡片即可激发全新碰撞灵感。",
                  });
                }
              }
            }
          }
        } catch {}
      }, 2500);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [mining, fetchTopics]);

  const sortedTopics = [...topics].sort((a, b) => {
    if (sortBy === "score") {
      return (b.score ?? 90) - (a.score ?? 90);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // 触发智能雷达碰撞（异步非阻塞执行）
  async function handleTriggerRadarMining() {
    if (mining) return;
    setMining(true);
    setMineNotice({
      type: "running",
      title: "雷达深度策划中",
      message: "正在对知识簇进行高维重组与大纲策划，请稍候…",
    });

    try {
      const res = await fetch("/api/topics/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          radar: true,
          angleType: activeAngle,
          count: 3,
        }),
      });
      const data = await res.json();
      if (res.ok && data.accepted) {
        // 保持 running 状态，等待轮询获取结果
      } else if (res.status === 409 || data.running) {
        setMineNotice({
          type: "running",
          title: "雷达任务运行中",
          message: data.error || "选题雷达正在深度碰撞中，请稍候...",
        });
      } else if (!res.ok) {
        setMineNotice({
          type: "error",
          title: "雷达启动失败",
          message: data.error || "大模型请求异常，请检查设置与网络",
        });
        setMining(false);
      }
    } catch {
      setMineNotice({
        type: "error",
        title: "网络请求异常",
        message: "未能连接到服务，请稍后重试",
      });
      setMining(false);
    }
  }

  // 切换选题状态（标记已创作 / 待写 / 归档）
  async function handleUpdateStatus(topic: TopicRepositoryItem, targetStatus: "idea" | "used" | "archived") {
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (res.ok) {
        setTopics((prev) =>
          prev.map((t) => (t.id === topic.id ? { ...t, status: targetStatus } : t)),
        );
        await fetchTopics();
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

  // 采纳选中的标题并一键进入工坊起草
  async function handleCreateWithTopic(topic: TopicRepositoryItem) {
    setNavigatingId(topic.id);
    try {
      const titleIndex = selectedTitles[topic.id] ?? 0;
      const chosenTitle =
        topic.titleOptions && topic.titleOptions[titleIndex]
          ? topic.titleOptions[titleIndex].replace(/^【[^】]+】\s*/, "")
          : topic.title;

      const card = topic.matchedCards?.[0];
      const itemIds =
        topic.matchedCards && topic.matchedCards.length > 0
          ? topic.matchedCards.map((c) => c.docId).filter(Boolean)
          : topic.sourceNoteIds || [];

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: chosenTitle,
          topicId: topic.id,
          targetSkill: topic.targetSkill,
          cardId: card?.id || null,
          itemIds,
          claimSnapshot: {
            claim: topic.coreArgument || topic.angle || card?.claim || chosenTitle,
            noteTitle: card?.noteTitle || null,
            boundary: "",
            cut: topic.hook || null,
          },
          selectedTopic: {
            title: chosenTitle,
            angle: topic.coreArgument || topic.angle,
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

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 md:p-8 pb-24">
      {/* 顶部标题与雷达触发区 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Zap className="size-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              选题雷达
            </h1>
            <span className="text-xs font-normal text-muted-foreground">Topic Radar</span>
            {stats && (
              <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-xs font-semibold font-mono">
                {stats.total} 条储备
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            连接知识库中的沉淀素材，智能推演高价值写作方案：反差突破 · 跨界隐喻 · 专题深度叙事。
          </p>
        </div>

        {/* 触发雷达碰撞主操作区：包含上次碰撞时间展示与防重复触发按钮 */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-auto">
          <div
            className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/60 px-2.5 py-1.5 rounded-xl shadow-2xs"
            title={
              stats?.lastScannedAt
                ? `上次选题时间：${new Date(stats.lastScannedAt).toLocaleString("zh-CN")}`
                : "尚未激发过选题"
            }
          >
            <Clock className="size-3.5 text-muted-foreground/70 shrink-0" />
            <span className="text-[11px] text-muted-foreground">上次选题：</span>
            <span className="font-mono text-[11px] font-medium text-foreground">
              {formatLastScannedTime(stats?.lastScannedAt)}
            </span>
          </div>

          <Button
            size="sm"
            onClick={handleTriggerRadarMining}
            disabled={mining}
            className="h-8.5 gap-1.5 rounded-xl text-xs font-semibold cursor-pointer shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-75 disabled:cursor-not-allowed"
            title={mining ? "AI 正在深度推演高传播力选题，请稍候..." : "基于知识库沉淀智能激发新选题"}
          >
            {mining ? (
              <Loader2 className="size-3.5 animate-spin text-primary-foreground" />
            ) : (
              <Sparkles className="size-3.5 text-amber-300 fill-amber-300" />
            )}
            <span>{mining ? "正在深度推演中…" : "激发全新选题灵感"}</span>
          </Button>
        </div>
      </div>

      {/* 碰撞反馈提示条（根据执行中、成功、已饱和、失败差异化渲染） */}
      {mineNotice && (
        <div
          className={cn(
            "flex items-start justify-between gap-3 rounded-xl border p-3.5 sm:p-4 text-xs animate-in fade-in duration-150 shadow-2xs",
            mineNotice.type === "running" &&
              "border-primary/30 bg-primary/5 text-primary",
            mineNotice.type === "success" &&
              "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200",
            mineNotice.type === "info" &&
              "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200",
            mineNotice.type === "error" &&
              "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {mineNotice.type === "running" && (
              <Loader2 className="size-4.5 animate-spin text-primary shrink-0 mt-0.5" />
            )}
            {mineNotice.type === "success" && (
              <CheckCircle2 className="size-4.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            {mineNotice.type === "info" && (
              <Sparkles className="size-4.5 text-amber-500 shrink-0 mt-0.5" />
            )}
            {mineNotice.type === "error" && (
              <AlertCircle className="size-4.5 text-destructive shrink-0 mt-0.5" />
            )}

            <div className="space-y-0.5 min-w-0">
              <div className="font-bold text-xs leading-snug">
                {mineNotice.title}
              </div>
              {mineNotice.message && (
                <p className="text-[11px] opacity-90 leading-relaxed break-words">
                  {mineNotice.message}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMineNotice(null)}
            className="text-[11px] opacity-70 hover:opacity-100 cursor-pointer shrink-0 font-medium px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
          >
            关闭
          </button>
        </div>
      )}

      {/* 雷达三种碰撞模式策略选择器 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {RADAR_ANGLES.map((angle) => {
          const isActive = activeAngle === angle.id;
          const Icon = angle.icon;
          return (
            <button
              key={angle.id}
              type="button"
              onClick={() => setActiveAngle(angle.id)}
              className={cn(
                "group relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer shadow-2xs",
                isActive
                  ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                  : "border-border/80 bg-card hover:border-foreground/30 hover:bg-muted/40",
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn("size-3.5", angle.color)} />
                <span className="text-xs font-bold text-foreground">
                  {angle.label}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                {angle.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* 检索与综合过滤栏 */}
      <div className="space-y-2.5 rounded-xl bg-card border p-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索选题方案、核心论点或关键词……"
              className="h-8 pl-8 text-xs rounded-lg bg-background"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto no-scrollbar w-full sm:w-auto">
            {/* 状态过滤 */}
            <div className="flex items-center rounded-lg border bg-background p-0.5 text-xs">
              {(
                [
                  { id: "all", label: "全部" },
                  { id: "idea", label: "待写" },
                  { id: "used", label: "已成稿" },
                  { id: "archived", label: "已归档" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                    statusFilter === tab.id
                      ? "bg-foreground text-background font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 排序方式 */}
            <div className="flex items-center rounded-lg border bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSortBy("score")}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors cursor-pointer flex items-center gap-1",
                  sortBy === "score"
                    ? "bg-background text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Flame className="size-3 text-amber-500" />
                <span>评分最高</span>
              </button>
              <button
                type="button"
                onClick={() => setSortBy("created")}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors cursor-pointer flex items-center gap-1",
                  sortBy === "created"
                    ? "bg-background text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Clock className="size-3" />
                <span>最新生成</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 选题雷达卡片流 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground space-y-3">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="text-xs font-medium">正在加载灵感选题库……</p>
        </div>
      ) : sortedTopics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed p-6 space-y-3 bg-card/40">
          <Lightbulb className="size-10 text-muted-foreground/40" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">暂无符合条件的选题灵感</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              点击上方「激发全新选题灵感」，AI 将基于你的个人知识库，智能推演多元成文命题与大纲。
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleTriggerRadarMining}
            disabled={mining}
            className="h-8 gap-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <Zap className="size-3.5 text-amber-300" />
            <span>立即激发选题灵感</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {sortedTopics.map((topic) => {
            const isUsed = topic.status === "used";
            const isArchived = topic.status === "archived";
            const selectedIdx = selectedTitles[topic.id] ?? 0;
            const isExpanded = expandedDetails[topic.id] ?? false;

            const angleTag =
              topic.angleType === "paradox"
                ? { label: "反差碰撞", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" }
                : topic.angleType === "intersection"
                  ? { label: "跨界同构", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" }
                  : { label: "专题纵深", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };

            const titles = topic.titleOptions && topic.titleOptions.length > 0
              ? topic.titleOptions
              : [topic.title];

            const currentDisplayTitle = titles[selectedIdx] || topic.title;

            return (
              <Card
                key={topic.id}
                className={cn(
                  "group relative flex flex-col justify-between rounded-2xl border bg-card p-4 sm:p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm space-y-3.5",
                  isUsed && "border-dashed bg-muted/20 opacity-85",
                  isArchived && "opacity-60 bg-muted/30",
                )}
              >
                <div className="space-y-3">
                  {/* 顶栏元数据 */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold border", angleTag.color)}>
                        {angleTag.label}
                      </span>

                      {topic.targetAudience && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                          <Users className="size-3" />
                          <span>受众: {topic.targetAudience}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 评分徽章 */}
                      <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 font-mono shadow-2xs">
                        <Flame className="size-3 text-amber-500 shrink-0" />
                        <span>{topic.score || 92}分</span>
                        {topic.scoreTag && (
                          <span className="font-sans font-medium text-[10px] opacity-90 pl-1 border-l border-amber-500/30">
                            {topic.scoreTag.replace(/^[^a-zA-Z\u4e00-\u9fa5]+/, "")}
                          </span>
                        )}
                      </div>

                      {/* 状态切换标签 */}
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateStatus(
                            topic,
                            isUsed ? "idea" : "used",
                          )
                        }
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors cursor-pointer shrink-0 flex items-center gap-1",
                          isUsed
                            ? "border-border bg-muted/80 text-muted-foreground hover:bg-muted"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20",
                        )}
                        title={isUsed ? "点击标记为待写" : "点击标记为已成稿"}
                      >
                        <span className={cn("size-1.5 rounded-full", isUsed ? "bg-muted-foreground/60" : "bg-emerald-500")} />
                        <span>{isUsed ? "已成稿" : "待写"}</span>
                      </button>
                    </div>
                  </div>

                  {/* 核心主标题（折叠态直接展示当前选中的主标题） */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug break-words flex-1">
                      {currentDisplayTitle}
                    </h3>
                  </div>

                  {/* 折叠模式下的一句话切角预览 */}
                  {!isExpanded && (topic.coreArgument || topic.angle) && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      <span className="font-medium text-foreground/80">核心论点：</span>
                      {topic.coreArgument || topic.angle}
                    </p>
                  )}

                  {/* 展开态详细内容：全篇机制 + 3选1标题矩阵 + 绑定卡片 + 结构大纲 */}
                  {isExpanded && (
                    <div className="space-y-3.5 pt-1 animate-in fade-in-0 duration-150">
                      {/* 全篇底层机制 */}
                      <div className="rounded-xl border border-border/80 bg-muted/30 p-3 text-xs text-foreground/90 leading-relaxed space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-primary text-[11px]">
                          <Zap className="size-3.5" />
                          <span>底层论述机制与破题逻辑：</span>
                        </div>
                        <p className="font-medium text-xs leading-relaxed text-foreground">
                          {topic.coreArgument || topic.angle}
                        </p>
                      </div>

                      {/* 3 选 1 多风格标题矩阵 */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                          <span>多风格标题矩阵（点选即采纳为成文标题）：</span>
                          <span className="text-[10px] text-muted-foreground/70">
                            {titles.length} 种风格
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {titles.map((titleOpt, tIdx) => {
                            const isChosen = selectedIdx === tIdx;
                            return (
                              <div
                                key={tIdx}
                                onClick={() =>
                                  setSelectedTitles((prev) => ({
                                    ...prev,
                                    [topic.id]: tIdx,
                                  }))
                                }
                                className={cn(
                                  "flex items-start gap-2.5 rounded-xl border p-2.5 transition-all cursor-pointer text-xs",
                                  isChosen
                                    ? "border-primary bg-primary/5 text-foreground font-semibold shadow-2xs"
                                    : "border-border/60 bg-card/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                                )}
                              >
                                <input
                                  type="radio"
                                  name={`title_${topic.id}`}
                                  checked={isChosen}
                                  onChange={() => {}}
                                  className="mt-0.5 size-3.5 text-primary accent-primary cursor-pointer shrink-0"
                                />
                                <span className="leading-snug break-words flex-1">
                                  {titleOpt}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 绑定的知识卡片资产 */}
                      {topic.matchedCards && topic.matchedCards.length > 0 && (
                        <div className="pt-2 border-t border-border/40 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <IdCard className="size-3 text-primary" />
                            <span>引用的原子知识卡片 ({topic.matchedCards.length} 张)：</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {topic.matchedCards.map((card, cIdx) => (
                              <span
                                key={cIdx}
                                className="inline-flex items-center gap-1.5 rounded-md bg-secondary/80 border border-border/60 px-2.5 py-1 text-[11px] text-foreground font-medium max-w-full"
                                title={`卡片断言：${card.claim}${card.noteTitle ? `\n来源笔记：《${card.noteTitle}》` : ""}`}
                              >
                                <span className="size-1.5 rounded-full bg-primary shrink-0" />
                                <span className="truncate max-w-[360px] sm:max-w-[480px]">
                                  {card.claim || (card.noteTitle ? `《${card.noteTitle}》` : "原子卡片")}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 结构化递进大纲 */}
                      {((topic.outlineStructured && topic.outlineStructured.length > 0) ||
                        (topic.outline && topic.outline.length > 0)) && (
                        <div className="pt-2 border-t border-border/40 space-y-2">
                          <div className="text-[11px] font-semibold text-muted-foreground">
                            成文递进大纲 ({topic.outlineStructured?.length || topic.outline?.length || 4} 段)：
                          </div>
                          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2 text-xs">
                            {topic.outlineStructured && topic.outlineStructured.length > 0 ? (
                              <div className="space-y-2">
                                {topic.outlineStructured.map((step, sIdx) => (
                                  <div key={sIdx} className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-foreground text-[11px]">
                                        {step.step}
                                      </span>
                                      {step.referencedCardId && (
                                        <span className="rounded bg-primary/10 text-primary px-1.5 py-0.2 text-[10px] font-mono">
                                          锚定卡片: {step.referencedCardTitle || step.referencedCardId.slice(0, 8)}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed pl-2.5 border-l border-primary/30">
                                      {step.guideline}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
                                {topic.outline?.map((item, idx) => (
                                  <li key={idx} className="leading-snug">
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 卡片底栏操作 */}
                <div className="pt-2.5 border-t border-border/40 flex flex-wrap items-center justify-between gap-2.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {/* 折叠/展开详情按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedDetails((prev) => ({
                          ...prev,
                          [topic.id]: !isExpanded,
                        }))
                      }
                      className="h-7 px-2 text-xs text-primary hover:bg-primary/10 rounded-md font-medium cursor-pointer gap-1"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="size-3.5" />
                          <span>收起详情</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-3.5" />
                          <span>
                            展开详情 ({titles.length} 标题 / 大纲)
                          </span>
                        </>
                      )}
                    </Button>

                    <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground/80">
                      <Clock className="size-3" />
                      <span>
                        {topic.createdAt
                          ? new Date(topic.createdAt).toLocaleDateString("zh-CN")
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {topic.usedProjectId && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-7 px-2 text-xs rounded-md font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        <Link href={`/works/${topic.usedProjectId}`}>
                          <FileText className="size-3 mr-1" />
                          <span>产出作品</span>
                        </Link>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUpdateStatus(topic, "archived")}
                      className="h-7 px-2 text-xs rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                      title="淘汰该选题，不再主动推荐"
                    >
                      <span>不感兴趣</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(topic)}
                      className="h-7 px-2 text-xs rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="彻底删除该选题"
                    >
                      <Trash2 className="size-3 mr-1" />
                      <span>删除</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleCreateWithTopic(topic)}
                      disabled={navigatingId === topic.id}
                      className="h-7.5 px-3 rounded-lg text-xs font-semibold gap-1 cursor-pointer shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {navigatingId === topic.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <>
                          <PenLine className="size-3" />
                          <span>以此开写</span>
                          <ArrowRight className="size-3" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 删除确认弹窗 */}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Trash2 className="size-4" />
              </span>
              彻底删除该选题？
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 leading-relaxed">
              确定要删除选题「{pendingDelete?.title}」吗？删除后不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
              className="text-xs rounded-lg"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDeleteTopic}
              disabled={deleting}
              className="text-xs rounded-lg gap-1.5"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              <span>确认删除</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
