"use client";

import { FolderPlus, Loader2 } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewKbDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/kbs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      if (res.ok) {
        setName("");
        setDescription("");
        onOpenChange(false);
        onCreated();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="size-4 text-primary" />
            新建独立知识库
          </DialogTitle>
          <DialogDescription>
            创建不同主题的独立知识库，用于分类隔离不同领域的原料沉淀。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">知识库名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：行业研报库 / 读书笔记 / 深度思考"
              className="text-xs"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">描述说明（可选）</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要说明该知识库的定位与收集方向"
              className="text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={saving || !name.trim()} size="sm" className="text-xs">
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1" />
                创建中...
              </>
            ) : (
              "创建知识库"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
