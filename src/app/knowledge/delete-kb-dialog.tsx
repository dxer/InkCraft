"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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

interface DeleteKbDialogProps {
  kb: KnowledgeBase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteKbDialog({
  kb,
  open,
  onOpenChange,
  onDeleted,
}: DeleteKbDialogProps) {
  const [loading, setLoading] = useState(false);

  if (!kb) return null;

  async function handleDelete() {
    if (!kb) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/kbs/${kb.id}`, { method: "DELETE" });
      if (res.ok) {
        onOpenChange(false);
        onDeleted();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5 p-6 rounded-2xl">
        <DialogHeader className="gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
              确定删除知识库「{kb.name}」？
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              此操作不可逆。删除后，该知识库内部包含的{" "}
              <span className="font-semibold text-foreground">
                {kb.notesCount} 篇笔记与素材
              </span>{" "}
              将自动安全归集迁移至
              <span className="font-semibold text-foreground">「主知识库」</span>
              ，不会丢失任何数据内容。
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="mt-2 flex items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-9 px-4 rounded-xl text-xs"
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
            className="h-9 px-4 rounded-xl text-xs font-semibold gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>正在删除...</span>
              </>
            ) : (
              <span>确认删除</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
