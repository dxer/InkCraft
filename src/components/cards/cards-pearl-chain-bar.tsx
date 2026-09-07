"use client";

import {
  ArrowRight,
  GitCommit,
  Layers,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import type { ParsedCardItem } from "./card-utils";

interface CardsPearlChainBarProps {
  pearlChain: ParsedCardItem[];
  onRemovePearl: (cardId: string) => void;
  onClearPearlChain: () => void;
  onComposePearlChain: (chain: ParsedCardItem[]) => void;
}

export function CardsPearlChainBar({
  pearlChain,
  onRemovePearl,
  onClearPearlChain,
  onComposePearlChain,
}: CardsPearlChainBarProps) {
  if (pearlChain.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-background/95 p-3 shadow-2xl backdrop-blur-xl ring-1 ring-amber-500/20">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
            <Sparkles className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <span>串珍珠路径成文</span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.2 text-[10px] text-amber-700 dark:text-amber-300 font-bold">
                {pearlChain.length} 个断言节点
              </span>
            </div>

            {/* 珍珠链条项水平滚动 */}
            <div className="no-scrollbar mt-1 flex items-center gap-1.5 overflow-x-auto py-0.5">
              {pearlChain.map((card, idx) => (
                <React.Fragment key={card.id}>
                  {idx > 0 && (
                    <ArrowRight className="size-2.5 shrink-0 text-muted-foreground/60" />
                  )}
                  <span className="group inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                    <span className="truncate max-w-[120px]">{card.title}</span>
                    <button
                      type="button"
                      onClick={() => onRemovePearl(card.id)}
                      className="text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧动作 */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearPearlChain}
            title="清空已选路径"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer"
          >
            <Trash2 className="size-3.5" />
          </Button>

          <Button
            size="sm"
            onClick={() => onComposePearlChain(pearlChain)}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold bg-linear-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 shadow-xs cursor-pointer"
          >
            <Sparkles className="size-3.5" />
            串联开写
          </Button>
        </div>
      </div>
    </div>
  );
}
