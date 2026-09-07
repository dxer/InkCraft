"use client";

import {
  Check,
  Compass,
  Copy,
  FileText,
  IdCard,
  MessageSquare,
  PenLine,
  Share2,
  Sparkles,
  Tag,
  Trash2,
  Zap,
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
import { Textarea } from "@/components/ui/textarea";
import { extractFrontmatter, parseCardFields } from "@/lib/card-md";
import { PLATFORM_SKILLS, type KnowledgeCard, type PlatformSkillId } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  formatCardDate,
  parseCardItem,
  type CardListItem,
  type ParsedCardItem,
} from "@/components/cards/card-utils";
import {
  CardsViewSwitcher,
  type CardViewMode,
} from "@/components/cards/cards-view-switcher";
import { CardsMasonryView } from "@/components/cards/cards-masonry-view";
import { CardsCompactTableView } from "@/components/cards/cards-compact-table-view";
import { CardsGraphView } from "@/components/cards/cards-graph-view";
import { CardsPearlChainBar } from "@/components/cards/cards-pearl-chain-bar";

export default function CardsPage() {
  const [cards, setCards] = useState<CardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CardViewMode>("masonry");

  // 串珍珠多选路径 (Pearl Chaining)
  const [pearlChain, setPearlChain] = useState<ParsedCardItem[]>([]);

  // 交互弹窗状态
  const [selectedCard, setSelectedCard] = useState<ParsedCardItem | null>(null);
  const [writeCard, setWriteCard] = useState<ParsedCardItem | null>(null);
  const [multiCardsWrite, setMultiCardsWrite] = useState<ParsedCardItem[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ParsedCardItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  // 初始化读取本地视图偏好
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("inkcraft_cards_view_mode") as CardViewMode;
      if (savedMode && ["masonry", "compact", "graph"].includes(savedMode)) {
        setViewMode(savedMode);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleViewModeChange = (mode: CardViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("inkcraft_cards_view_mode", mode);
    } catch {
      // ignore
    }
  };

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

  // 解析全部卡片为标准原子卡对象
  const parsedCards = useMemo(() => {
    return cards.map(parseCardItem);
  }, [cards]);

  // 收集所有标签
  const allTags = useMemo(() => {
    const tagMap = new Map<string, number>();
    parsedCards.forEach((c) => {
      c.tags.forEach((t) => {
        tagMap.set(t, (tagMap.get(t) || 0) + 1);
      });
    });
    return Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);
  }, [parsedCards]);

  // 过滤卡片列表
  const filteredCards = useMemo(() => {
    let result = parsedCards;

    // 标签筛选
    if (selectedTag) {
      result = result.filter((c) => c.tags.includes(selectedTag));
    }

    // 关键词搜索
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.hook.toLowerCase().includes(q) ||
          c.noteTitle.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)) ||
          c.body.toLowerCase().includes(q)
      );
    }

    return result;
  }, [parsedCards, selectedTag, search]);

  // 串珍珠操作
  const togglePearlChain = (card: ParsedCardItem) => {
    setPearlChain((prev) => {
      const exists = prev.some((c) => c.id === card.id);
      if (exists) {
        return prev.filter((c) => c.id !== card.id);
      }
      return [...prev, card];
    });
  };

  const removePearl = (cardId: string) => {
    setPearlChain((prev) => prev.filter((c) => c.id !== cardId));
  };

  const clearPearlChain = () => {
    setPearlChain([]);
  };

  // 删除卡片
  async function confirmDeleteCard() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      const res = await fetch(`/api/cards/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCards((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      setPearlChain((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      if (selectedCard?.id === pendingDelete.id) setSelectedCard(null);
      setPendingDelete(null);
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8 pb-20">
      {/* 顶部横幅 */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-foreground">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IdCard className="size-4" />
            </span>
            知识卡片库
            <span className="text-xs font-normal text-muted-foreground">
              Permanent Notes Gallery
            </span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            基于卢曼卡片盒与自媒体传播学：自洽原子命题 · 痛点切入 Hook · 知识网络拓扑。
          </p>
        </div>

        {/* 统计指标 */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border/80 bg-card px-3.5 py-1.5 shadow-2xs">
            <div className="text-[10px] text-muted-foreground font-medium">原子卡片</div>
            <div className="text-sm font-semibold tabular-nums text-foreground">
              {cards.length} <span className="text-[11px] font-normal text-muted-foreground">张</span>
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-card px-3.5 py-1.5 shadow-2xs">
            <div className="text-[10px] text-muted-foreground font-medium">概念标签</div>
            <div className="text-sm font-semibold tabular-nums text-primary">
              {allTags.length} <span className="text-[11px] font-normal text-muted-foreground">个</span>
            </div>
          </div>
        </div>
      </header>

      {/* 搜索与视图切换控制条 */}
      <CardsViewSwitcher
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        search={search}
        onSearchChange={setSearch}
        allTags={allTags}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        totalCards={parsedCards.length}
        filteredCount={filteredCards.length}
      />

      {/* 主展示区 */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl border border-border/60 bg-muted/40"
            />
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 py-16 text-center bg-card/50">
          <IdCard className="mx-auto size-9 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {cards.length === 0 ? "还没有提炼知识卡片" : "没有找到匹配的卡片"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {cards.length === 0
              ? "前往知识库录入笔记或剪藏文章，后台会自动蒸馏为高价值原子卡片。"
              : "尝试更换关键词或清除标签筛选。"}
          </p>
          {selectedTag && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTag(null)}
              className="mt-4 text-xs rounded-lg cursor-pointer"
            >
              清除标签 #{selectedTag}
            </Button>
          )}
        </div>
      ) : (
        /* 根据当前模式渲染三种视图 */
        <div className="transition-opacity duration-200">
          {viewMode === "masonry" && (
            <CardsMasonryView
              cards={filteredCards}
              onSelectCard={setSelectedCard}
              onWriteWithCard={setWriteCard}
              onDeleteCard={setPendingDelete}
              onSelectTag={setSelectedTag}
              selectedTag={selectedTag}
            />
          )}

          {viewMode === "compact" && (
            <CardsCompactTableView
              cards={filteredCards}
              onSelectCard={setSelectedCard}
              onWriteWithCard={setWriteCard}
              onDeleteCard={setPendingDelete}
              onSelectTag={setSelectedTag}
              selectedTag={selectedTag}
            />
          )}

          {viewMode === "graph" && (
            <CardsGraphView
              cards={filteredCards}
              onSelectCard={setSelectedCard}
              onWriteWithCard={setWriteCard}
              onSelectTag={setSelectedTag}
              selectedTag={selectedTag}
              pearlChain={pearlChain}
              onTogglePearlChain={togglePearlChain}
            />
          )}
        </div>
      )}

      {/* 底部串珍珠路径成文浮动栏 */}
      <CardsPearlChainBar
        pearlChain={pearlChain}
        onRemovePearl={removePearl}
        onClearPearlChain={clearPearlChain}
        onComposePearlChain={(chain) => setMultiCardsWrite(chain)}
      />

      {/* 瀑布/列表模式下的卡片完整详情弹窗 */}
      <CardDetailDialog
        card={selectedCard}
        onOpenChange={(open) => !open && setSelectedCard(null)}
        onWriteWithCard={(card) => {
          setSelectedCard(null);
          setWriteCard(card);
        }}
      />

      {/* 单卡 / 多卡二次创作确认弹窗 */}
      <WriteWithCardDialog
        card={writeCard}
        multiCards={multiCardsWrite}
        open={!!writeCard || !!multiCardsWrite}
        onOpenChange={(open) => {
          if (!open) {
            setWriteCard(null);
            setMultiCardsWrite(null);
          }
        }}
      />

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
              删除这张原子卡片？
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-1">
              《{pendingDelete?.noteTitle || "未命名笔记"}》
              <br />
              <span className="text-foreground/80 font-medium">
                {pendingDelete?.title}
              </span>
              <br />
              <span className="text-muted-foreground mt-1 inline-block">
                源笔记不受影响，后续可在笔记详情页随时重新萃取。
              </span>
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              删除失败，请稍后重试。
            </p>
          )}
          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-md text-xs cursor-pointer"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="rounded-md bg-destructive text-xs font-semibold text-white hover:bg-destructive/90 cursor-pointer"
              disabled={deleting}
              onClick={() => void confirmDeleteCard()}
            >
              {deleting ? "删除中…" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 完整卡片详情弹窗 */
function CardDetailDialog({
  card,
  onOpenChange,
  onWriteWithCard,
}: {
  card: ParsedCardItem | null;
  onOpenChange: (open: boolean) => void;
  onWriteWithCard: (card: ParsedCardItem) => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!card) return null;

  function handleCopy() {
    if (!card) return;
    navigator.clipboard.writeText(card.raw.content_md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
                  {card.title}
                </DialogTitle>
                <DialogDescription className="truncate text-xs text-muted-foreground mt-0.5">
                  来源笔记：《{card.noteTitle}》
                </DialogDescription>
              </div>
            </div>

            {card.tags && card.tags.length > 0 && (
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {card.tags.map((tag) => (
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
          {/* 自媒体 Hook 专属高亮块 */}
          {card.hook && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Zap className="size-3.5" />
                自媒体痛点切入点（Hook / 爆款引子）
              </div>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-amber-900 dark:text-amber-100">
                {card.hook}
              </p>
            </div>
          )}

          {/* 卡片纯净 Markdown 正文渲染 */}
          <MdText text={card.body} className="leading-relaxed" />
        </div>

        {/* 底栏 */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-3.5">
          <span className="truncate text-[11px] text-muted-foreground">
            {formatCardDate(card.updatedAt)}
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

/** 用这张卡写 / 串珍珠多卡开写：确认层 + 建项目 */
function WriteWithCardDialog({
  card,
  multiCards,
  open,
  onOpenChange,
}: {
  card: ParsedCardItem | null;
  multiCards?: ParsedCardItem[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  // 单卡时解析 fields
  const singleFields = useMemo(() => {
    return card ? parseCardFields(card.raw.content_md) : null;
  }, [card]);

  // 组合多卡时的复合主张与标题
  const defaultClaim = useMemo(() => {
    if (multiCards && multiCards.length > 0) {
      return multiCards.map((c, i) => `${i + 1}. ${c.title}`).join("\n");
    }
    return singleFields?.claim || "";
  }, [multiCards, singleFields]);

  const [claim, setClaim] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<PlatformSkillId>("wechat");
  const [agents, setAgents] = useState<{ id: string; name: string; stage: string; persona: string | null }[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setClaim(defaultClaim);
  }, [defaultClaim]);

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

  const isMulti = !!(multiCards && multiCards.length > 0);
  const activeCards = multiCards && multiCards.length > 0 ? multiCards : card ? [card] : [];
  if (activeCards.length === 0) return null;

  async function confirmWrite() {
    if (creating) return;
    const finalClaim = claim.trim();
    if (!finalClaim) {
      setError("主张不能为空");
      return;
    }
    setCreating(true);
    setError(null);

    const primaryCard = activeCards[0];
    const sourceTitles = Array.from(new Set(activeCards.map((c) => c.noteTitle))).join(" / ");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: primaryCard.id,
          targetSkill: selectedSkill,
          claimSnapshot: {
            claim: finalClaim,
            noteTitle: sourceTitles,
            boundary: isMulti
              ? `串联节点: ${activeCards.map((c) => c.title).join(" ➔ ")}`
              : singleFields?.applicable || null,
            cut: isMulti ? `多卡片拓扑串联大纲 (${activeCards.length}个断言)` : singleFields?.cut || null,
            confidence: "high",
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

  const selectedDisplayName = getSkillDisplayName(selectedSkill);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl rounded-2xl p-5"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {isMulti ? `串珍珠成文 (${activeCards.length}个拓扑节点)` : "选择技能去创作"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isMulti
              ? "已将选中的拓扑路径串联为复合命题大纲，AI 将融合多个断言一步成稿。"
              : "选择目标平台创作技能，AI 将直接结合卡片断言与知识库素材一步成稿。"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          {/* 创作技能选择磁贴 */}
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
              <span className="text-xs font-medium text-foreground">
                {isMulti ? "复合命题路径（可自由调整顺序与要点）" : "卡片核心主张（可微调）"}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{claim.length} 字</span>
            </div>
            <Textarea
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              rows={isMulti ? 4 : 2}
              className="min-h-0 resize-none rounded-xl text-xs leading-relaxed font-mono"
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
            {creating ? "正在载入工坊…" : `以「${selectedDisplayName}」开写`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 卡片字段 markdown 渲染：与编辑器预览同源（marked） */
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
