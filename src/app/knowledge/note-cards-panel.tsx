"use client";

import {
  ArrowUpRight,
  BookOpen,
  Check,
  Compass,
  Copy,
  FileText,
  IdCard,
  Loader2,
  MessageSquare,
  PenLine,
  RefreshCw,
  Share2,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { extractFrontmatter, parseCardFields } from "@/lib/card-md";
import { PLATFORM_SKILLS, type KnowledgeCard, type NoteItem, type PlatformSkillId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NoteCardsPanelProps {
  note: NoteItem | null;
  cards: KnowledgeCard[];
  loading: boolean;
  extracting: boolean;
  extractResult?: string | null;
  onExtractCards: () => void;
}

export function NoteCardsPanel({
  note,
  cards,
  loading,
  extracting,
  extractResult,
  onExtractCards,
}: NoteCardsPanelProps) {
  const [selectedCard, setSelectedCard] = useState<KnowledgeCard | null>(null);
  const [writeCard, setWriteCard] = useState<KnowledgeCard | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, card: KnowledgeCard) => {
    e.stopPropagation();
    navigator.clipboard.writeText(card.content_md);
    setCopiedId(card.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <aside className="hidden xl:flex w-80 shrink-0 flex-col border-l bg-card/60 overflow-hidden">
      {/* 头部标题与重新提炼按钮 */}
      <div className="flex items-center justify-between border-b p-3.5 bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IdCard className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground">精炼知识卡片</span>
              <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary tabular-nums">
                {cards.length}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              核心论点与金句萃取
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onExtractCards}
          disabled={extracting || !note}
          title="根据当前笔记内容重新提炼卡片"
          className="h-7 gap-1 px-2 text-[11px] rounded-md cursor-pointer border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40"
        >
          {extracting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          <span>{extracting ? "提炼中..." : "重新提炼"}</span>
        </Button>
      </div>

      {/* 提示反馈信息 */}
      {extractResult && (
        <div
          className={cn(
            "mx-3 mt-2 rounded-lg px-2.5 py-1 text-[11px] font-medium animate-in fade-in",
            extractResult.includes("失败")
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
          )}
        >
          {extractResult}
        </div>
      )}

      {/* 卡片列表展示区 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="space-y-2.5 pt-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl border bg-muted/40" />
            ))}
          </div>
        ) : !note ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            请选择左侧笔记查看对应卡片
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center space-y-3 bg-muted/10">
            <IdCard className="mx-auto size-8 text-muted-foreground/40" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">暂无提炼的知识卡片</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                AI 将深度剖析笔记，提炼出 1~3 张包含核心论点、亮眼金句与关键事实的精炼卡片。
              </p>
            </div>
            <Button
              size="sm"
              onClick={onExtractCards}
              disabled={extracting}
              className="h-8 gap-1.5 px-3 text-xs font-semibold rounded-lg cursor-pointer"
            >
              {extracting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              <span>{extracting ? "正在深度提炼中..." : "立即提炼知识卡片"}</span>
            </Button>
          </div>
        ) : (
          cards.map((card, idx) => {
            const { frontmatter, body } = extractFrontmatter(card.content_md);
            const title = frontmatter.title || "原子知识卡片";
            const hook = frontmatter.hook;
            const tags = (note.tags && note.tags.length > 0) ? note.tags : (frontmatter.tags || []);

            // 机制摘要截取
            const previewText = body
              .replace(/^#+\s*.*/gm, "")
              .replace(/[-*+]\s+/g, "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 90);

            return (
              <div
                key={card.id}
                onClick={() => setSelectedCard(card)}
                className="group relative rounded-xl border border-border/80 bg-card p-3.5 text-left shadow-2xs transition-all hover:border-primary/50 hover:shadow-xs cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  {/* 顶部标签与卡片序号 */}
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="font-semibold text-primary/80">
                      卡片 #{idx + 1}
                    </span>
                    {tags.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                        <Tag className="size-2.5 opacity-60" />
                        {tags.slice(0, 2).join(" · ")}
                      </span>
                    )}
                  </div>

                  {/* 断言标题 */}
                  <h4 className="text-xs font-bold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {title}
                  </h4>

                  {/* 传播 Hook */}
                  {hook && (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                      <div className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 text-[10px] mb-0.5">
                        <Zap className="size-2.5" />
                        传播 Hook
                      </div>
                      <p className="line-clamp-2">{hook}</p>
                    </div>
                  )}

                  {/* 核心机制简析 */}
                  {!hook && previewText && (
                    <p className="line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
                      {previewText}...
                    </p>
                  )}
                </div>

                {/* 底部快捷操作栏 */}
                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px]">
                  <span className="inline-flex items-center gap-0.5 font-medium text-primary text-[10px]">
                    查看完整卡片
                    <ArrowUpRight className="size-2.5" />
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="复制卡片 Markdown"
                      onClick={(e) => handleCopy(e, card)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                    >
                      {copiedId === card.id ? (
                        <Check className="size-3 text-primary" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWriteCard(card);
                      }}
                      className="h-6 gap-1 px-2 text-[10px] font-semibold rounded cursor-pointer"
                    >
                      <PenLine className="size-2.5" />
                      去创作
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 完整卡片详情弹窗 */}
      <DetailCardDialog
        card={selectedCard}
        noteTitle={note?.title || "未命名笔记"}
        onOpenChange={(open) => !open && setSelectedCard(null)}
        onWriteWithCard={(card) => {
          setSelectedCard(null);
          setWriteCard(card);
        }}
      />

      {/* 用这张卡去创作弹窗 */}
      <WriteWithCardDialog
        card={writeCard}
        noteTitle={note?.title || "未命名笔记"}
        open={!!writeCard}
        onOpenChange={(open) => !open && setWriteCard(null)}
      />
    </aside>
  );
}

/** 完整卡片详情弹窗 */
function DetailCardDialog({
  card,
  noteTitle,
  onOpenChange,
  onWriteWithCard,
}: {
  card: KnowledgeCard | null;
  noteTitle: string;
  onOpenChange: (open: boolean) => void;
  onWriteWithCard: (card: KnowledgeCard) => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!card) return null;

  const { frontmatter, body } = extractFrontmatter(card.content_md);

  function handleCopy() {
    if (!card) return;
    navigator.clipboard.writeText(card.content_md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const htmlBody = (() => {
    try {
      return renderMarkdown(body || "");
    } catch {
      return body;
    }
  })();

  return (
    <Dialog open={!!card} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IdCard className="size-4" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold truncate">
                  {frontmatter.title || "原子知识卡片"}
                </DialogTitle>
                <DialogDescription className="truncate text-xs text-muted-foreground mt-0.5">
                  来源笔记：《{noteTitle}》
                </DialogDescription>
              </div>
            </div>

            {frontmatter.tags && frontmatter.tags.length > 0 && (
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {frontmatter.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                  >
                    <Tag className="size-3 opacity-60" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="no-scrollbar max-h-[62vh] overflow-y-auto px-6 py-5 space-y-4">
          {/* 自媒体 Hook */}
          {frontmatter.hook && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Zap className="size-3.5" />
                自媒体痛点切入点（Hook / 爆款引子）
              </div>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-amber-900 dark:text-amber-100">
                {frontmatter.hook}
              </p>
            </div>
          )}

          {/* 正文 Markdown */}
          <div
            className="markdown-body text-xs leading-relaxed"
            dangerouslySetInnerHTML={{ __html: htmlBody }}
          />
        </div>

        {/* 底栏 */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-3.5">
          <span className="truncate text-[11px] text-muted-foreground">
            {card.updated_at ? new Date(card.updated_at).toLocaleDateString("zh-CN") : ""}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-lg text-xs cursor-pointer"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-primary" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  复制卡片
                </>
              )}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              onClick={() => onWriteWithCard(card)}
            >
              <PenLine className="size-3.5" />
              用这张卡写
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 用这张卡写：确认层 + 建项目 */
function WriteWithCardDialog({
  card,
  noteTitle,
  open,
  onOpenChange,
}: {
  card: KnowledgeCard | null;
  noteTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const fields = useMemo(() => {
    return card ? parseCardFields(card.content_md) : null;
  }, [card]);

  const [claim, setClaim] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<PlatformSkillId>("wechat");
  const [agents, setAgents] = useState<{ id: string; name: string; stage: string; persona: string | null }[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (fields?.claim) setClaim(fields.claim);
  }, [fields?.claim]);

  React.useEffect(() => {
    if (open) {
      fetch("/api/agents")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const list = (data?.agents || []).filter(
            (a: { stage: string; id: string; enabled?: boolean }) =>
              (["wechat", "xiaohongshu", "zhihu", "x_thread", "master"].includes(a.stage) ||
                a.id.startsWith("custom_")) &&
              a.enabled !== false
          );
          setAgents(list);
          if (list.length > 0) {
            const isSelectedActive = list.some(
              (a: { stage: string; id: string }) => a.stage === selectedSkill || a.id === selectedSkill
            );
            if (!isSelectedActive) {
              setSelectedSkill((list[0].stage || list[0].id) as PlatformSkillId);
            }
          }
        })
        .catch(() => {});
    }
  }, [open, selectedSkill]);

  if (!card || !fields) return null;

  async function confirmWrite() {
    if (!card || !fields || creating) return;
    const finalClaim = claim.trim();
    if (!finalClaim) {
      setError("主张不能为空");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          targetSkill: selectedSkill,
          claimSnapshot: {
            claim: finalClaim,
            noteTitle,
            boundary: fields.applicable || null,
            cut: fields.cut || null,
            confidence: fields.sourceShape || null,
          },
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      router.push(`/workshop?projectId=${data.project.id}&skill=${selectedSkill}`);
    } catch {
      setError("创建项目失败，请稍后重试");
      setCreating(false);
    }
  }

  const getSkillIcon = (id: string) => {
    switch (id) {
      case "wechat":
        return <MessageSquare className="size-4 text-emerald-500" />;
      case "xiaohongshu":
        return <Sparkles className="size-4 text-rose-500" />;
      case "zhihu":
        return <Compass className="size-4 text-blue-500" />;
      case "x_thread":
        return <Share2 className="size-4 text-zinc-700 dark:text-zinc-300" />;
      default:
        return <FileText className="size-4 text-purple-500" />;
    }
  };

  const getSkillDisplayName = (skillId: string) => {
    const matched = agents.find((a) => a.stage === skillId || a.id === skillId);
    if (matched) return matched.name;
    const fallback = PLATFORM_SKILLS.find((s) => s.id === skillId);
    return fallback ? fallback.name : skillId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl rounded-2xl p-5"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">以这张卡片去创作</DialogTitle>
          <DialogDescription className="text-xs">
            选择目标平台创作技能，AI 将直接结合卡片断言与知识库素材一步成稿。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-foreground">目标创作技能</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(agents.length > 0
                ? agents.map((a) => ({
                    id: (a.stage || a.id) as PlatformSkillId,
                    name: a.name,
                    desc: a.persona || "暂无人格口吻说明",
                    stage: a.stage || a.id,
                  }))
                : PLATFORM_SKILLS.map((s) => ({
                    id: s.id,
                    name: s.name,
                    desc: s.desc,
                    stage: s.id,
                  }))
              ).map((skill) => {
                const active = selectedSkill === skill.id || selectedSkill === skill.stage;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => setSelectedSkill(skill.id)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all cursor-pointer",
                      active
                        ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
                        : "border-border/70 bg-card hover:border-border hover:bg-muted/30"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">{getSkillIcon(skill.stage)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground truncate">{skill.name}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                        {skill.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-foreground">卡片核心主张（可微调）</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{claim.length} 字</span>
            </div>
            <Textarea
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              rows={2}
              className="min-h-0 resize-none rounded-xl text-xs leading-relaxed"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" size="sm" className="rounded-lg text-xs cursor-pointer" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            disabled={creating || !claim.trim()}
            onClick={() => void confirmWrite()}
          >
            <PenLine className="size-3.5" />
            {creating ? "正在载入工坊…" : `以「${getSkillDisplayName(selectedSkill)}」开写`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
