"use client";

import {
  Clock,
  Copy,
  History,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshots: ProjectSnapshot[];
  onRestoreSnapshot: (content: string) => void;
  onDeleteSnapshot?: (id: string) => void;
  onTakeSnapshot?: () => void;
}

export function VersionHistoryDialog({
  open,
  onOpenChange,
  snapshots = [],
  onRestoreSnapshot,
  onDeleteSnapshot,
  onTakeSnapshot,
}: VersionHistoryDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    snapshots[0]?.id || null
  );
  const [copied, setCopied] = useState(false);

  const selectedSnapshot =
    snapshots.find((s) => s.id === selectedId) || snapshots[0] || null;

  function handleCopyContent(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleRestore(snapshot: ProjectSnapshot) {
    onRestoreSnapshot(snapshot.content);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="border-b px-5 py-3.5 bg-muted/20">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <History className="size-4" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold">
                  草稿历史快照（防覆写安全网）
                </DialogTitle>
                <DialogDescription className="text-xs">
                  在 AI 重新起草或覆写前自动备份，随时可安全回滚至任意历史版本
                </DialogDescription>
              </div>
            </div>

            {onTakeSnapshot && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1 rounded-lg h-7 cursor-pointer"
                onClick={onTakeSnapshot}
              >
                <Sparkles className="size-3 text-amber-500" />
                拍摄当前快照
              </Button>
            )}
          </div>
        </DialogHeader>

        {snapshots.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Clock className="size-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">暂无历史快照</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              系统会在您点击「重新起草」或重要编辑节点前自动为您备份当前草稿。
            </p>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
            {/* 左侧版本列表 */}
            <div className="md:col-span-4 border-r bg-muted/10 overflow-y-auto p-3 space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1">
                共 {snapshots.length} 个快照版本
              </div>
              {snapshots.map((s, idx) => {
                const isSelected = selectedSnapshot?.id === s.id;
                const date = new Date(s.createdAt);
                const timeStr = isNaN(date.getTime())
                  ? s.createdAt
                  : `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
                const fullDateStr = isNaN(date.getTime())
                  ? ""
                  : `${date.getMonth() + 1}/${date.getDate()}`;

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col gap-1.5",
                      isSelected
                        ? "bg-background border-primary shadow-xs ring-1 ring-primary/20"
                        : "bg-background/60 hover:bg-background border-border/70"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="size-3 text-muted-foreground" />
                        <span>{fullDateStr} {timeStr}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4 font-normal",
                          s.trigger === "draft"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {s.trigger === "draft"
                          ? "起草前备份"
                          : s.trigger === "manual"
                            ? "手动快照"
                            : idx === 0
                              ? "最新版本"
                              : "历史版本"}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground line-clamp-2 text-[11px] leading-relaxed">
                      {s.preview || s.content?.slice(0, 60) || "(空白快照)"}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-1 border-t border-dashed">
                      <span>字数: {s.wordCount} 字</span>
                      {onDeleteSnapshot && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSnapshot(s.id);
                          }}
                          className="hover:text-destructive transition-colors p-0.5"
                          title="删除快照"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 右侧快照详情与恢复操作 */}
            <div className="md:col-span-8 flex flex-col h-full bg-background overflow-hidden">
              {selectedSnapshot ? (
                <>
                  <div className="flex items-center justify-between border-b px-5 py-2.5 bg-muted/5">
                    <div className="text-xs text-muted-foreground">
                      快照时间：
                      <span className="font-medium text-foreground ml-1">
                        {selectedSnapshot.createdAt}
                      </span>
                      <span className="mx-2 text-muted-foreground/40">|</span>
                      <span>{selectedSnapshot.wordCount} 字</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 rounded-lg cursor-pointer"
                        onClick={() => handleCopyContent(selectedSnapshot.content)}
                      >
                        <Copy className="size-3" />
                        {copied ? "已复制" : "复制快照内容"}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs"
                        onClick={() => handleRestore(selectedSnapshot)}
                      >
                        <RotateCcw className="size-3" />
                        恢复此版本到画布
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 p-5 overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap select-text bg-muted/10 text-foreground/90">
                    {selectedSnapshot.content || "(该快照内容为空)"}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                  请选择左侧快照查看详情
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
