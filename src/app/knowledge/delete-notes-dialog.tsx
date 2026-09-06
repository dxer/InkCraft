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

interface DeleteNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  title?: string;
  onConfirm: () => Promise<void>;
}

export function DeleteNotesDialog({
  open,
  onOpenChange,
  count,
  title,
  onConfirm,
}: DeleteNotesDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
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
              {title
                ? `确定删除笔记「${title}」？`
                : `确定批量删除选中的 ${count} 篇笔记？`}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              此操作不可逆。删除后，对应笔记内容将从当前知识库与系统中永久移除。
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
            onClick={handleConfirm}
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
