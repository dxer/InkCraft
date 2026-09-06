"use client";

import {
  ArrowRight,
  Check,
  Compass,
  Copy,
  FileText,
  Grip,
  IdCard,
  MessageSquare,
  PenLine,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseCardFields } from "@/lib/card-md";
import { PLATFORM_SKILLS, type KnowledgeCard, type PlatformSkillId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CardListItem extends KnowledgeCard {
  note_title: string | null;
  updated_at: string;
}

/** 从整卡 markdown 中提取画廊预览文本：lead 为首个正文行（观点），rest 为次行 */
function mdPreview(md: string): { lead: string; rest: string } {
  const isHeading = (l: string) => /^#{1,6}\s/.test(l);
  const plain = (l: string) =>
    l.replace(/^>\s*/, "").replace(/^[-*+]\s+\[[ xX]\]\s*/, "").replace(/^[-*+]\s+/, "").replace(/\*\*/g, "").trim();
  let lead = "";
  let rest = "";
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line || isHeading(line)) continue;
    const text = plain(line);
    if (!text || text === "—") continue;
    if (!lead) {
      lead = text;
      continue;
    }
    rest = text;
    break;
  }
  return { lead: lead || "空卡片", rest };
}

/** 卡片日期短格式：2026/9/6 */
function cardDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `萃取于 ${d.toLocaleDateString("zh-CN")}`;
}

export default function CardsPage() {
  const [cards, setCards] = useState<CardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CardListItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CardListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch("/api/cards");
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  async function confirmDeleteCard() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      const res = await fetch(`/api/cards/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCards((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      setSelected((prev) => (prev?.id === pendingDelete.id ? null : prev));
      setPendingDelete(null);
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.content_md.toLowerCase().includes(q) ||
        (c.note_title || "").toLowerCase().includes(q),
    );
  }, [cards, search]);

  // 主索引卡：取最新一张
  const hero = filtered[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      {/* 顶部横幅 */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IdCard className="size-4" />
            </span>
            卡片库
            <span className="text-sm font-normal text-muted-foreground">
              The Card Deck
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            文章入库后，AI 把每篇萃成一张「能出货」的八项知识卡片。
          </p>
        </div>
      </header>

      {/* 萃取统计 */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">AI 萃取统计</span>
          <span className="tabular-nums text-foreground">
            已入卡 {cards.length} 张
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          卡片由入库时的 AI 萃取异步生成；在笔记内容页可随时手动「重新生成」。
        </p>
      </div>

      {/* 搜索 */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="搜索卡片"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索观点、适用场景、来源..."
            className="pl-9 text-xs rounded-md"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl border bg-muted/40"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <IdCard className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium">
            {cards.length === 0 ? "还没有卡片" : "没有匹配的卡片"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cards.length === 0
              ? "去知识库写一条笔记或剪藏一篇文章，入库后会自动萃成卡片。"
              : "换一个关键词试试。"}
          </p>
        </div>
      ) : (
        /* 双栏画廊：左大索引卡 + 右次要卡 */
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* 左：主索引卡 */}
          {hero && (
            <div className="group relative">
              <button
                onClick={() => setSelected(hero)}
                className="group flex h-full w-full flex-col justify-between rounded-2xl border bg-card p-6 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md cursor-pointer overflow-hidden"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate pr-3">《{hero.note_title}》</span>
                  </div>
                  <p className="text-xl font-semibold leading-relaxed tracking-tight text-foreground">
                    {mdPreview(hero.content_md).lead}
                  </p>
                  <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {mdPreview(hero.content_md).rest}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    查看完整卡片
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {cardDate(hero.updated_at)}
                  </span>
                </div>
              </button>
              <DeleteCardButton
                onClick={() => setPendingDelete(hero)}
                deleting={deleting}
              />
            </div>
          )}

          {/* 右：次要卡列 */}
          <div className="grid gap-3">
            {filtered.slice(1, 5).map((c) => (
              <MiniCard
                key={c.id}
                card={c}
                deleting={false}
                onClick={() => setSelected(c)}
                onDelete={() => setPendingDelete(c)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 完整卡片详情弹窗 */}
      <CardDetailDialog
        card={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />

      {/* 删除确认弹框（应用内，不用系统 confirm） */}
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
              删除这张卡片？
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              《{pendingDelete?.note_title || "未命名笔记"}》
              <br />
              源笔记不受影响，之后可随时在笔记页重新萃取。
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
              className="rounded-md"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="rounded-md bg-destructive font-semibold text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => void confirmDeleteCard()}
            >
              {deleting ? "删除中…" : "确认删除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 悬停出现的删除按钮（卡片右上角；父容器需带 group 类） */
function DeleteCardButton({
  onClick,
  deleting,
}: {
  onClick: () => void;
  deleting: boolean;
}) {
  return (
    <button
      aria-label="删除卡片"
      title="删除卡片"
      disabled={deleting}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute top-3 right-3 z-10 flex size-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 shadow-xs backdrop-blur transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 disabled:pointer-events-none"
    >
      <Trash2 className={cn("size-3.5", deleting && "animate-pulse")} />
    </button>
  );
}

function MiniCard({
  card,
  onClick,
  onDelete,
  deleting,
}: {
  card: CardListItem;
  onClick: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className="flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm cursor-pointer pr-9"
      >
        <Grip className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {mdPreview(card.content_md).lead}
          </p>
          <p className="line-clamp-1 text-[11px] text-muted-foreground">
            《{card.note_title}》
            {card.updated_at && (
              <span className="ml-1.5 text-muted-foreground/70">
                · {new Date(card.updated_at).toLocaleDateString("zh-CN")}
              </span>
            )}
          </p>
        </div>
      </button>
      <DeleteCardButton onClick={onDelete} deleting={deleting} />
    </div>
  );
}

function CardDetailDialog({
  card,
  onOpenChange,
}: {
  card: CardListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  if (!card) return null;
  const current = card;

  function handleCopy() {
    navigator.clipboard.writeText(current.content_md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={!!card} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-xl p-0 sm:max-w-3xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b bg-muted/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5 pr-8">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IdCard className="size-4" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold">
                知识卡片
              </DialogTitle>
              <DialogDescription className="truncate text-xs">
                《{card.note_title || "未命名笔记"}》
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 整卡内容就是一份 markdown 文档，直接渲染 */}
        <MdText
          text={card.content_md}
          className="no-scrollbar max-h-[62vh] overflow-y-auto px-6 py-5"
        />

        {/* 底栏：萃取日期 | 复制 + 送去工坊二次创作 */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3">
          <span className="truncate text-[11px] text-muted-foreground">
            萃取于{" "}
            {card.updated_at
              ? new Date(card.updated_at).toLocaleDateString("zh-CN")
              : "—"}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-md text-xs"
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
              className="gap-1.5 rounded-md text-xs font-semibold"
              onClick={() => setWriteOpen(true)}
            >
              <PenLine className="size-3.5" />
              用这张卡写
            </Button>
          </div>
        </div>

        {/* 二次创作确认层：冻结主张快照，确认后建项目进锁题 */}
        <WriteWithCardDialog
          card={current}
          open={writeOpen}
          onOpenChange={setWriteOpen}
        />
      </DialogContent>
    </Dialog>
  );
}

/** 用这张卡写：确认层 + 建项目（卡片模式，从锁题进入） */
function WriteWithCardDialog({
  card,
  open,
  onOpenChange,
}: {
  card: CardListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const fields = useMemo(() => parseCardFields(card.content_md), [card.content_md]);
  // 原卡主张多长就放多长：不截断，用户可自由增删
  const [claim, setClaim] = useState(fields.claim);
  const [selectedSkill, setSelectedSkill] = useState<PlatformSkillId>("wechat");
  const [agents, setAgents] = useState<{ id: string; name: string; stage: string; persona: string | null }[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  const boundary =
    [fields.applicable, fields.notApplicable]
      .filter(Boolean)
      .map((s, i) => (i === 0 ? `适用：${s}` : `反适用：${s}`))
      .join("；") || null;

  async function confirmWrite() {
    if (creating) return;
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
            noteTitle: card.note_title,
            boundary,
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

  const rows: { label: string; value: string | null }[] = [
    ...(fields.tension
      ? [
          { label: "惯性误区", value: fields.tension.misconception || null },
          { label: "破局逻辑", value: fields.tension.solution || null },
        ]
      : []),
    { label: "边界约束", value: boundary },
    { label: "破题切口", value: fields.cut || null },
    { label: "金句原句", value: fields.quote || null },
  ];

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

  const selectedDisplayName = getSkillDisplayName(selectedSkill);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl rounded-xl p-5"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">选择技能去创作</DialogTitle>
          <DialogDescription className="text-xs">
            选择目标平台创作技能，AI 将直接结合卡片论点与知识库素材一步成稿。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          {/* 创作技能选择磁贴（仅展示已启用的技能） */}
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
                      "flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all cursor-pointer",
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
              className="min-h-0 resize-none rounded-md text-xs leading-relaxed"
            />
          </div>

          {rows
            .filter((r) => r.value)
            .map((r) => (
              <div key={r.label} className="rounded-lg bg-muted/40 px-3 py-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">{r.label}</span>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground">{r.value}</p>
              </div>
            ))}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" size="sm" className="rounded-md text-xs" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-md text-xs font-semibold"
            disabled={creating || !claim.trim()}
            onClick={() => void confirmWrite()}
          >
            <PenLine className="size-3.5" />
            {creating ? "正在载入工坊…" : `以「${selectedDisplayName}」开写`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 卡片字段 markdown 渲染：与编辑器预览同源（marked），直接输出阅读排版 */
function MdText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => {
    try {
      return marked.parse(text || "", { gfm: true, breaks: true }) as string;
    } catch {
      return text;
    }
  }, [text]);
  return (
    <div
      className={cn("markdown-body", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
