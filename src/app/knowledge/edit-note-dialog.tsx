"use client";

import { Edit3, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeBase, NoteItem } from "@/lib/types";

interface Props {
  note: NoteItem;
  kbs: KnowledgeBase[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditNoteDialog({ note, kbs, open, onOpenChange, onSaved }: Props) {
  const [title, setTitle] = useState(note.title || "");
  const [content, setContent] = useState(note.content || "");
  const [kbId, setKbId] = useState(note.kbId || "default");
  const [tagsStr, setTagsStr] = useState((note.tags || []).join(" "));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    const tags = tagsStr
      .replace(/#/g, "")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          content: content.trim(),
          kbId,
          tags,
        }),
      });
      if (res.ok) {
        onOpenChange(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-xl p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Edit3 className="size-4 text-primary" />
            编辑笔记信息
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            修改笔记标题、归属知识库、正文与标签。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">标题</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="笔记标题（可选）"
                className="text-xs rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">所属知识库</Label>
              <Select value={kbId} onValueChange={(val) => setKbId(val)}>
                <SelectTrigger className="h-8 text-xs rounded-md">
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
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <Label className="text-xs">笔记正文 (Markdown)</Label>
              <span className="text-muted-foreground tabular-nums">{content.length} 字</span>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="笔记正文内容..."
              className="min-h-60 font-mono text-xs leading-relaxed rounded-md"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">标签（空格分隔，如：思考 架构 写作）</Label>
            <Input
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="如：思考 架构 写作"
              className="text-xs rounded-md"
            />
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-md">
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !content.trim()} size="sm" className="rounded-md text-xs font-semibold">
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1" />
                保存中...
              </>
            ) : (
              "保存修改"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
