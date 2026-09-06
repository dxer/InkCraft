"use client";

import { CornerDownLeft, Loader2, Search, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CitationItem } from "@/app/api/ask/route";
import type { KnowledgeBase } from "@/lib/types";

export function AskCommandDialog() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [scope, setScope] = useState<"all" | "category" | "kb">("all");
  const [scopeValue, setScopeValue] = useState("");
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<{
    answer: string;
    citations: CitationItem[];
  } | null>(null);
  const [activeCitation, setActiveCitation] = useState<CitationItem | null>(
    null,
  );

  const isWorkshop = pathname.startsWith("/workshop");
  const isKnowledge = pathname.startsWith("/knowledge");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      fetch("/api/kbs")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.kbs) setKbs(data.kbs);
        })
        .catch(() => {});
    }
  }, [open]);

  async function handleAsk() {
    if (!question.trim() || asking) return;
    setAsking(true);
    setResult(null);
    setActiveCitation(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          scope,
          scopeValue,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } finally {
      setAsking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" />
              全库 AI 问答 · ⌘J
            </DialogTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isWorkshop && (
                <Badge variant="secondary" className="text-[10px]">
                  工坊视图
                </Badge>
              )}
              {isKnowledge && (
                <Badge variant="secondary" className="text-[10px]">
                  知识库视图
                </Badge>
              )}
              <span className="font-mono text-[11px]">ESC 关闭</span>
            </div>
          </div>
          {/* 范围选择 */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">检索范围：</span>
            <div className="flex gap-1">
              <Button
                variant={scope === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 rounded-full px-2 text-[11px]"
                onClick={() => {
                  setScope("all");
                  setScopeValue("");
                }}
              >
                全库原料
              </Button>
              {kbs.length > 0 && (
                <Button
                  variant={scope === "kb" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 rounded-full px-2 text-[11px]"
                  onClick={() => {
                    setScope("kb");
                    setScopeValue(kbs[0]?.id || "default");
                  }}
                >
                  指定知识库
                </Button>
              )}
              <Button
                variant={scope === "category" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 rounded-full px-2 text-[11px]"
                onClick={() => {
                  setScope("category");
                  if (!scopeValue) setScopeValue("认知模型");
                }}
              >
                指定分类
              </Button>
            </div>
            {scope === "kb" && (
              <Select
                value={scopeValue || kbs[0]?.id || "default"}
                onValueChange={(val) => setScopeValue(val)}
              >
                <SelectTrigger className="h-6 text-[11px] rounded-lg px-2 min-w-28">
                  <SelectValue placeholder="选择知识库" />
                </SelectTrigger>
                <SelectContent>
                  {kbs.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {scope === "category" && (
              <Input
                aria-label="分类名"
                value={scopeValue}
                onChange={(e) => setScopeValue(e.target.value)}
                placeholder="输入分类名"
                className="h-6 w-28 text-[11px]"
              />
            )}
          </div>
        </DialogHeader>

        {/* 提问输入框 */}
        <div className="relative border-b px-4 py-2">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="提问内容"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder={
              isWorkshop
                ? "向全知识库提问（如：这个选题有哪些可用的论据？）..."
                : "向知识库提问（如：如何理解流水线比仓库更重要？）..."
            }
            className="border-0 pl-7 shadow-none focus-visible:ring-0 text-sm"
            autoFocus
          />
          <Button
            size="sm"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-7 gap-1 text-xs"
            onClick={handleAsk}
            disabled={!question.trim() || asking}
          >
            {asking ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <>
                <span>提问</span>
                <CornerDownLeft className="size-3" />
              </>
            )}
          </Button>
        </div>

        {/* 回答与引用展示 */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {asking && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-xs">检索相关切片并提炼带引用解答...</span>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  AI 提炼回答：
                </div>
                <div className="rounded-lg bg-muted/40 p-3.5 text-sm leading-relaxed text-foreground">
                  <FormattedAnswer
                    text={result.answer}
                    onCitationClick={(idx) => {
                      const item = result.citations.find(
                        (c) => c.index === idx,
                      );
                      if (item) setActiveCitation(item);
                    }}
                  />
                </div>
              </div>

              {/* 引用切片卡片 */}
              {result.citations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">
                    引用资料切片（点击高亮）：
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {result.citations.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setActiveCitation(c)}
                        className={`cursor-pointer rounded-md border p-2.5 text-xs transition-colors ${
                          activeCitation?.id === c.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0"
                          >
                            [{c.index}]
                          </Badge>
                          <span className="truncate">{c.title}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-muted-foreground leading-relaxed">
                          {c.excerpt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!result && !asking && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              输入问题并回车，AI 将跨全库检索并给出带切片引用角标的精准回答。
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormattedAnswer({
  text,
  onCitationClick,
}: {
  text: string;
  onCitationClick: (idx: number) => void;
}) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const match = p.match(/^\[(\d+)\]$/);
        if (match) {
          const idx = parseInt(match[1], 10);
          return (
            <button
              key={i}
              onClick={() => onCitationClick(idx)}
              className="mx-0.5 inline-flex items-center justify-center rounded bg-primary/10 px-1 py-0.2 text-[11px] font-bold text-primary hover:bg-primary/20"
            >
              [{idx}]
            </button>
          );
        }
        return p;
      })}
    </>
  );
}
