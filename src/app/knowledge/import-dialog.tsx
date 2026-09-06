"use client";

import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function ImportDialog({ open, onOpenChange, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20_000_000) {
      setError("文件过大（超过 20MB）");
      return;
    }
    setError(null);
    setSelectedFile(file);
    setTitle((t) => t || file.name.replace(/\.[^.]+$/, ""));

    if (file.name.endsWith(".pdf")) {
      setContent(
        `[已选中 PDF 文件：${file.name} (${(file.size / 1024).toFixed(1)} KB)]\n点击下方“导入”将自动提取文字并切片入库。`,
      );
    } else {
      setContent(await file.text());
    }
  }

  async function submit() {
    if ((!content.trim() && !selectedFile) || busy) return;
    setBusy(true);
    setError(null);

    try {
      let res: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (title.trim()) formData.append("title", title.trim());
        res = await fetch("/api/notes", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "paste",
            title: title.trim(),
            content: content.trim(),
          }),
        });
      }

      if (res.ok) {
        setTitle("");
        setContent("");
        setSelectedFile(null);
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
      <DialogContent className="sm:max-w-2xl rounded-xl p-5">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            导入长文与文献
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            支持导入 Markdown、TXT、PDF 文档或直接粘贴正文，自动分块并建立 FTS5
            倒排索引。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="flex gap-2">
            <Input
              aria-label="笔记标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="标题（可留空，AI 将自动命名）"
              className="text-xs rounded-md"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,.txt,.pdf"
              className="hidden"
              onChange={onFile}
            />
            <Button
              variant="outline"
              onClick={pickFile}
              size="sm"
              className="gap-1.5 shrink-0 rounded-md text-xs"
            >
              <Upload className="size-3.5" />
              上传文件 (.md / .pdf / .txt)
            </Button>
          </div>
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setSelectedFile(null);
            }}
            placeholder="粘贴 Markdown 或纯文本正文..."
            className="min-h-56 resize-y font-mono text-xs leading-relaxed rounded-md"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {selectedFile
                ? `已挂载文件: ${selectedFile.name}`
                : "支持直接粘贴全文"}
            </span>
            <span className="tabular-nums">
              {content.length > 0 ? `${content.length} 字` : ""}
            </span>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
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
            disabled={(!content.trim() && !selectedFile) || busy}
            className="rounded-md text-xs font-semibold"
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1" />
                分块入库中...
              </>
            ) : (
              "导入入库"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
