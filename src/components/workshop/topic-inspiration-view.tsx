"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  ExternalLink,
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
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { IdeatedTopic } from "@/app/api/workshop/ideate/route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLATFORM_SKILLS, type PlatformSkillId, type TopicRepositoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TopicInspirationViewProps {
  onSelectTopic: (topic: IdeatedTopic) => void;
  initialSkill?: PlatformSkillId;
}

export function TopicInspirationView({
  onSelectTopic,
  initialSkill,
}: TopicInspirationViewProps) {
  const [direction, setDirection] = useState("");
  const [preferredSkill, setPreferredSkill] = useState<PlatformSkillId | "all">(
    initialSkill || "all"
  );
  const [repoTopics, setRepoTopics] = useState<TopicRepositoryItem[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genNotice, setGenNotice] = useState<string | null>(null);

  // 从选题库中直接读取数据（0 token，毫秒级快速加载）
  const fetchRepoTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/topics?status=idea");
      if (res.ok) {
        const data = await res.json();
        setRepoTopics(data.topics || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  // 页面初次进入时只读库，绝不自动调用大模型
  useEffect(() => {
    void fetchRepoTopics();
  }, [fetchRepoTopics]);

  // 仅当用户主动点击时，才调用 AI 进行现场碰撞生成
  async function handleGenerateNew(dir?: string, skill?: PlatformSkillId | "all") {
    if (generating) return;
    setGenerating(true);
    setError(null);
    setGenNotice(null);

    const activeDir = dir !== undefined ? dir : direction;
    const activeSkill = skill !== undefined ? skill : preferredSkill;

    try {
      const res = await fetch("/api/workshop/ideate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: activeDir === "全部知识储备碰撞" ? "" : activeDir,
          preferredSkill: activeSkill === "all" ? undefined : activeSkill,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "生成选题失败");
      }

      const data = await res.json();
      const newItems: IdeatedTopic[] = data?.topics || [];
      setGenNotice(`已成功生成 ${newItems.length} 个全新选题并存入选题库！`);
      setPageIndex(0);
      // 重新拉取库中最新列表
      await fetchRepoTopics();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成选题失败，请稍后重试");
    } finally {
      setGenerating(false);
    }
  }

  // 根据当前输入的搜索词与所选平台进行本地即时过滤
  const filteredTopics = repoTopics.filter((t) => {
    const matchSkill = preferredSkill === "all" || t.targetSkill === preferredSkill;
    const kw = direction.trim().toLowerCase();
    const matchKw =
      !kw ||
      kw === "全部知识储备碰撞" ||
      t.title.toLowerCase().includes(kw) ||
      (t.angle && t.angle.toLowerCase().includes(kw));
    return matchSkill && matchKw;
  });

  const PAGE_SIZE = 4;
  const totalBatches = Math.ceil(filteredTopics.length / PAGE_SIZE) || 1;
  const currentBatchIndex = pageIndex % totalBatches;
  const displayedTopics = filteredTopics.slice(
    currentBatchIndex * PAGE_SIZE,
    (currentBatchIndex + 1) * PAGE_SIZE
  );

  function handleNextBatch() {
    setPageIndex((prev) => (prev + 1) % totalBatches);
  }

  const getSkillIcon = (id: string) => {
    switch (id) {
      case "wechat":
        return <MessageSquare className="size-3.5 text-emerald-500 shrink-0" />;
      case "xiaohongshu":
        return <Sparkles className="size-3.5 text-rose-500 shrink-0" />;
      case "zhihu":
        return <Compass className="size-3.5 text-blue-500 shrink-0" />;
      case "x_thread":
        return <Share2 className="size-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />;
      default:
        return <FileText className="size-3.5 text-purple-500 shrink-0" />;
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* 极简顶栏 */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card/60 px-6 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">墨匠工坊 · 创作灵感大厅</span>
        </div>
        <Link
          href="/topics"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Lightbulb className="size-3.5 text-amber-500" />
          <span>选题库管理 ({repoTopics.length})</span>
          <ExternalLink className="size-3 text-muted-foreground/60" />
        </Link>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 md:px-12 no-scrollbar">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* 主标题标语区 */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              今天想创作些什么？
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
              从选题库中直接挑选沉淀好的高价值选题开写，或按需让 AI 现场碰撞新灵感。
            </p>
          </div>

          {/* 筛选与生成控制栏 */}
          <div className="rounded-2xl border bg-card/80 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleGenerateNew();
                  }}
                  placeholder="搜索现有选题关键词，或输入特定方向让 AI 现场生成……"
                  className="h-10 pl-9 text-xs rounded-xl bg-background"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  size="default"
                  onClick={() => void handleGenerateNew()}
                  disabled={generating}
                  className="h-10 flex-1 sm:flex-initial px-4 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
                  title="让 AI 现场分析并生成一批全新选题"
                >
                  {generating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5 text-amber-300" />
                  )}
                  <span>{generating ? "AI 碰撞中…" : "让 AI 现场碰撞新灵感"}</span>
                </Button>
              </div>
            </div>

            {/* 平台技能偏好筛选 */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/40">
              <span className="text-[11px] text-muted-foreground font-medium shrink-0">适配平台：</span>
              <button
                type="button"
                onClick={() => setPreferredSkill("all")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer border",
                  preferredSkill === "all"
                    ? "border-foreground/30 bg-foreground text-background font-semibold"
                    : "border-transparent bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                全平台推荐
              </button>
              {PLATFORM_SKILLS.map((skill) => {
                const active = preferredSkill === skill.id;
                const count = repoTopics.filter((t) => t.targetSkill === skill.id).length;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => setPreferredSkill(skill.id)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer border",
                      active
                        ? cn(skill.color, "font-semibold border-current shadow-2xs")
                        : "border-transparent bg-muted/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {skill.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* 生成反馈提示 */}
          {genNotice && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary flex items-center justify-between">
              <span>{genNotice}</span>
              <button
                type="button"
                onClick={() => setGenNotice(null)}
                className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                关闭
              </button>
            </div>
          )}

          {/* 错误提醒 */}
          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive text-center">
              {error}
            </div>
          )}

          {/* 选题网格卡片 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">精选待写选题（来自选题库）</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                  共 {filteredTopics.length} 个切角 {totalBatches > 1 && `· 第 ${currentBatchIndex + 1}/${totalBatches} 批`}
                </span>
              </div>
              {filteredTopics.length > PAGE_SIZE && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextBatch}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                  title="切换下一批选题"
                >
                  <RefreshCw className="size-3 mr-0.5" />
                  <span>换一批</span>
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
                <Loader2 className="size-7 animate-spin text-primary" />
                <p className="text-xs font-medium text-foreground">正在加载选题库……</p>
              </div>
            ) : filteredTopics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3 rounded-2xl border border-dashed text-center p-6">
                <Lightbulb className="size-9 text-muted-foreground/40" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">暂无符合条件的选题</p>
                  <p className="text-[11px] text-muted-foreground">
                    点击下方按钮让 AI 立即从你的知识库中挖掘并策划一批全新选题。
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => void handleGenerateNew()}
                  disabled={generating}
                  className="text-xs font-semibold gap-1.5 cursor-pointer mt-1"
                >
                  {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-amber-300" />}
                  <span>{generating ? "AI 碰撞中…" : "立即让 AI 挖掘选题"}</span>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedTopics.map((item, idx) => {
                  const skillMeta =
                    PLATFORM_SKILLS.find((s) => s.id === item.targetSkill) || PLATFORM_SKILLS[0];

                  return (
                    <div
                      key={item.id || idx}
                      className="group relative flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-md space-y-3.5"
                    >
                      <div className="space-y-2.5">
                        {/* 平台徽章与爆款指数 */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold flex items-center gap-1", skillMeta.color)}>
                              {getSkillIcon(item.targetSkill)}
                              <span>{item.targetSkillName || skillMeta.name}</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {item.sourceType === "auto" ? "⚡ 自动挖掘" : "🎨 工坊沉淀"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 shadow-2xs font-mono">
                            <Flame className="size-3 text-amber-500 shrink-0" />
                            <span>{item.score || 92}分</span>
                            {item.scoreTag && (
                              <span className="font-sans font-medium text-[10px] opacity-90 pl-1 border-l border-amber-500/30">
                                {item.scoreTag.replace(/^[^a-zA-Z\u4e00-\u9fa5]+/, "")}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 标题 */}
                        <h3 className="text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>

                        {/* 核心切角 */}
                        {item.angle && (
                          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                            <span className="font-semibold text-foreground/90">🎯 核心切角：</span>
                            {item.angle}
                          </div>
                        )}

                        {/* 破题钩子 */}
                        {item.hook && (
                          <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2.5 line-clamp-2">
                            “{item.hook}”
                          </p>
                        )}

                        {/* 递进骨架大纲 */}
                        {item.outline && item.outline.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <div className="text-[10px] font-semibold text-muted-foreground">论证推进大纲：</div>
                            <ul className="space-y-0.5">
                              {item.outline.slice(0, 3).map((line, oIdx) => (
                                <li key={oIdx} className="text-xs text-muted-foreground/90 font-mono truncate">
                                  {line}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* 关联卡片 */}
                        {item.matchedCards && item.matchedCards.length > 0 && (
                          <div className="pt-2 border-t border-border/40">
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
                              <IdCard className="size-3 text-primary" />
                              <span>关联知识储备 ({item.matchedCards.length})：</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {item.matchedCards.slice(0, 2).map((card, cIdx) => (
                                <span
                                  key={card.id || cIdx}
                                  className="inline-block rounded-md bg-primary/5 border border-primary/15 px-2 py-0.5 text-[10px] text-primary truncate max-w-[220px]"
                                  title={card.claim}
                                >
                                  {card.noteTitle ? `《${card.noteTitle}》` : card.claim}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 底部一键进入创作按钮 */}
                      <div className="pt-3 border-t border-border/40">
                        <Button
                          size="default"
                          onClick={() => {
                            onSelectTopic({
                              id: item.id,
                              title: item.title,
                              angle: item.angle,
                              hook: item.hook,
                              targetSkill: item.targetSkill,
                              targetSkillName: item.targetSkillName || skillMeta.name,
                              outline: item.outline,
                              matchedCards: item.matchedCards,
                            });
                          }}
                          className="w-full h-9 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-xs group-hover:bg-primary group-hover:text-primary-foreground"
                        >
                          <span>就写这个 · 载入工坊创作</span>
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
