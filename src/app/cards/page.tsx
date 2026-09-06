"use client";

import {
  ArrowRight,
  Check,
  FileText,
  Grip,
  IdCard,
  Image as ImageIcon,
  ListChecks,
  Mic,
  Minus,
  Search,
  Tag,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { KnowledgeCard, CardSupport } from "@/lib/cards";
import { cn } from "@/lib/utils";

interface CardListItem extends KnowledgeCard {
  note_title: string | null;
  updated_at: string;
}

const CRED_META: Record<string, { label: string; cls: string }> = {
  亲历: {
    label: "亲历",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  二手: {
    label: "二手",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  待验证: {
    label: "待验证",
    cls: "border-muted-foreground/30 bg-muted/20 text-muted-foreground",
  },
};

const SUPPORT_LABEL: Record<CardSupport["type"], string> = {
  data: "数据",
  case: "亲历 · 案例",
  counter: "反例 · 边界",
};

const REUSABLE_ICON: Record<string, typeof FileText> = {
  长文段落: FileText,
  清单: ListChecks,
  口播: Mic,
  金句图: ImageIcon,
};

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
        c.one_liner.toLowerCase().includes(q) ||
        c.audience.toLowerCase().includes(q) ||
        (c.note_title || "").toLowerCase().includes(q) ||
        (c.golden_line || "").toLowerCase().includes(q),
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
                  {hero.golden_line && (
                    <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                      有金句 ✓
                    </span>
                  )}
                </div>
                <p className="text-xl font-semibold leading-relaxed tracking-tight text-foreground">
                  “{hero.one_liner}”
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {hero.audience}
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
          {card.one_liner}
        </p>
        <p className="line-clamp-1 text-[11px] text-muted-foreground">
          《{card.note_title}》
        </p>
      </div>
      {card.golden_line && (
        <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
          ✦
        </Badge>
      )}
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
  if (!card) return null;
  const cred = CRED_META[card.credibility] || CRED_META["待验证"];

  return (
    <Dialog open={!!card} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IdCard className="size-4" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold">
                  知识卡片
                </DialogTitle>
                <DialogDescription className="text-xs">
                  《{card.note_title || "未命名笔记"}》
                </DialogDescription>
              </div>
            </div>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                cred.cls,
              )}
            >
              {card.credibility}
            </span>
          </div>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-5 overflow-y-auto pr-1 text-xs">
          {/* 1 一句话观点 */}
          <section>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ① 一句话观点
            </div>
            <p className="text-[15px] font-semibold leading-relaxed text-foreground">
              “{card.one_liner}”
            </p>
          </section>

          {/* 2 适用对象+场景 */}
          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ② 适用对象 + 场景
            </div>
            <p className="leading-relaxed text-foreground/85">
              {card.audience}
            </p>
          </section>

          {/* 3 三个支撑 */}
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ③ 三个支撑
            </div>
            <div className="space-y-2">
              {card.supports.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-3"
                >
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px] font-normal"
                  >
                    {SUPPORT_LABEL[s.type] || "支撑"}
                  </Badge>
                  <span className="leading-relaxed text-foreground/85">
                    {s.text}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 4 最小行动 */}
          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ④ 一个最小行动
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
              {card.min_action}
            </div>
          </section>

          {/* 5 可复用形态 */}
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ⑤ 可复用形态
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {card.reusable.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border bg-background p-2.5"
                >
                  {(() => {
                    const ReusableIcon = REUSABLE_ICON[r.type] || Tag;
                    return (
                      <ReusableIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    );
                  })()}
                  <div>
                    <div className="font-semibold text-foreground">
                      {r.type}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {r.angle}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 6 来源与可信度 */}
          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ⑥ 来源与可信度
            </div>
            <div className="flex items-center gap-2">
              <span className="truncate text-foreground/85">
                《{card.source_note}》
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  cred.cls,
                )}
              >
                {card.credibility}
              </span>
            </div>
          </section>

          {/* 7 一句话自检 */}
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ⑦ 一句话自检
            </div>
            <div className="space-y-1.5">
              <SelfCheckRow
                done={card.self_check.hasDetail}
                label="有亲手细节"
              />
              <SelfCheckRow
                done={card.self_check.portable}
                label="换平台还能讲"
              />
              <SelfCheckRow
                done={card.self_check.readyToPublish}
                label="现在能发或只差一点"
              />
            </div>
          </section>

          {/* 8 金句/钩子 */}
          <section className="border-t border-border/40 pt-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ⑧ 金句 / 钩子
            </div>
            {card.golden_line ? (
              <p className="text-[14px] font-medium italic leading-relaxed text-foreground">
                “{card.golden_line}”
              </p>
            ) : (
              <p className="text-muted-foreground/60">
                空 —— 写稿时再补上标题或开场。
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SelfCheckRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-foreground/85">
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-full border",
          done
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
            : "border-border text-muted-foreground",
        )}
      >
        {done ? <Check className="size-2.5" /> : <Minus className="size-2.5" />}
      </span>
      <span>{label}</span>
    </div>
  );
}
