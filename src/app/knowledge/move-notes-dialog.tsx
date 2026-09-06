"use client";

import { useState } from "react";
import { Folder, FolderInput, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { KnowledgeBase } from "@/lib/types";

interface MoveNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteIds: string[];
  kbs: KnowledgeBase[];
  currentKbId: string;
  onMoved: () => void;
}

export function MoveNotesDialog({
  open,
  onOpenChange,
  noteIds,
  kbs,
  currentKbId,
  onMoved,
}: MoveNotesDialogProps) {
  const [targetKbId, setTargetKbId] = useState<string>(
    kbs.find((k) => k.id !== currentKbId)?.id || "default"
  );
  const [loading, setLoading] = useState(false);

  const availableKbs = kbs.filter((k) => k.id !== currentKbId);

  async function handleMove() {
    if (!targetKbId || noteIds.length === 0) return;
    setLoading(true);
    try {
      await Promise.all(
        noteIds.map((id) =>
          fetch(`/api/notes/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kbId: targetKbId }),
          })
        )
      );
      onOpenChange(false);
      onMoved();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <FolderInput className="size-4 text-primary" />
            移动笔记至知识库
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            已选择 <span className="font-semibold text-foreground">{noteIds.length}</span> 篇笔记，请选择目标知识库：
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-2">
          {availableKbs.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              暂无其他可用知识库，可在知识库画廊中新建。
            </div>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {availableKbs.map((kb) => {
                const isSelected = targetKbId === kb.id;
                return (
                  <div
                    key={kb.id}
                    onClick={() => setTargetKbId(kb.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 font-medium text-foreground"
                        : "bg-card hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Folder className="size-4 text-primary" />
                      <span className="text-sm font-semibold">{kb.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {kb.notesCount} 篇笔记
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleMove}
            disabled={loading || availableKbs.length === 0}
            className="rounded-xl text-xs font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1" />
                移动中...
              </>
            ) : (
              "确认移动"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
