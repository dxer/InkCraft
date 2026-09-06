"use client";

import {
  ArrowRight,
  Check,
  Copy,
  Grip,
  Hammer,
  IdCard,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KnowledgeCard } from "@/lib/cards";
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

export default function CardsPage() {
  const [cards, setCards] = useState<CardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CardListItem | null>(null);

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
            <button
              onClick={() => setSelected(hero)}
              className="group flex h-full flex-col justify-between rounded-2xl border bg-card p-6 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md cursor-pointer overflow-hidden"
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
                  # 主卡
                </span>
              </div>
            </button>
          )}

          {/* 右：次要卡列 */}
          <div className="grid gap-3">
            {filtered.slice(1, 5).map((c) => (
              <MiniCard key={c.id} card={c} onClick={() => setSelected(c)} />
            ))}
          </div>
        </div>
      )}

      {/* 完整卡片详情弹窗 */}
      <CardDetailDialog
        card={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

function MiniCard({
  card,
  onClick,
}: {
  card: CardListItem;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm cursor-pointer"
    >
      <Grip className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {mdPreview(card.content_md).lead}
        </p>
        <p className="line-clamp-1 text-[11px] text-muted-foreground">
          《{card.note_title}》
        </p>
      </div>
    </button>
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
  const router = useRouter();
  if (!card) return null;
  const current = card;

  function handleCopy() {
    navigator.clipboard.writeText(current.content_md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /** 二次创作：卡片观点作为选题种子 + 源笔记挂为工坊素材，交给流水线创作 */
  function handleSendToWorkshop() {
    const { lead, rest } = mdPreview(current.content_md);
    const payload = {
      topic: {
        title: lead.length > 50 ? `${lead.slice(0, 50)}…` : lead,
        angle: `基于知识卡片《${current.note_title || "未命名笔记"}》进行二次创作。卡片观点：${lead}${rest ? ` 适用：${rest}` : ""}`,
        outline: [
          "引入：以一句话观点与金句钩子切入",
          "展开：用三个支撑、案例与反例充实论证",
          "落点：以最小行动与可复用形态收束",
        ],
      },
      materialIds: current.document_id ? [current.document_id] : [],
    };
    sessionStorage.setItem("inkcraft_pending_topic", JSON.stringify(payload));
    router.push("/workshop");
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

        {/* 底栏：复制 + 送去工坊二次创作 */}
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
              onClick={handleSendToWorkshop}
            >
              <Hammer className="size-3.5" />
              送去工坊创作
            </Button>
          </div>
        </div>
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
