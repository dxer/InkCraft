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
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeBase } from "@/lib/types";

interface Props {
  kb: KnowledgeBase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditKbDialog({ kb, open, onOpenChange, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {kb && (
          <EditKbForm
            key={kb.id}
            kb={kb}
            onCancel={() => onOpenChange(false)}
            onSaved={() => {
              onOpenChange(false);
              onSaved();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditKbForm({
  kb,
  onCancel,
  onSaved,
}: {
  kb: KnowledgeBase;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(kb.name || "");
  const [description, setDescription] = useState(kb.description || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kbs/${kb.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });
      if (res.ok) {
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Edit3 className="size-4 text-primary" />
          编辑知识库信息
        </DialogTitle>
        <DialogDescription>
          修改知识库名称与定位描述。
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3.5 py-2">
        <div className="space-y-1.5">
          <Label className="text-xs">知识库名称</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：行业研报库"
            className="text-xs"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">描述说明</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要说明该知识库的定位与收集方向"
            className="text-xs min-h-20 resize-none leading-relaxed"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()} size="sm" className="text-xs">
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
    </>
  );
}
