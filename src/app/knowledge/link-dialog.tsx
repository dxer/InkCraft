"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function LinkDialog({ open, onOpenChange, onCreated }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "url", url: url.trim() }),
      });
      if (res.ok) {
        setUrl("");
        onOpenChange(false);
        onCreated();
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "入库失败，请重试");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl p-5">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            网页链接剪藏
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            粘贴 URL，AI 自动抓取正文并分块入库
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <Input
            aria-label="链接地址"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="https://..."
            className="text-xs rounded-md"
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-md text-xs"
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={() => void submit()}
            disabled={!url.trim() || busy}
            className="rounded-md text-xs font-semibold"
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1" />
                抓取正文中...
              </>
            ) : (
              "抓取入库"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
