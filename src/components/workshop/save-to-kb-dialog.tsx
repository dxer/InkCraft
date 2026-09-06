"use client";

import { Check, ExternalLink, Folder, FolderPlus, Layers, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { KnowledgeBase } from "@/lib/types";

export interface SaveToKbDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle: string;
  masterContent: string;
  variants?: Record<string, string>; // platformId -> content
  initialPlatform?: string; // 默认选中的平台 key
  onSaved?: (noteId: string) => void;
}

const PLATFORM_NAMES: Record<string, string> = {
  master: "成稿母稿",
  wechat: "微信公众号版",
  xiaohongshu: "小红书版",
  zhihu: "知乎版",
  x_thread: "X Thread 版",
};

export function SaveToKbDialog({
  open,
  onOpenChange,
  defaultTitle,
  masterContent,
  variants = {},
  initialPlatform = "master",
  onSaved,
}: SaveToKbDialogProps) {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>("default");
  const [selectedVersion, setSelectedVersion] = useState<string>(initialPlatform);
  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<string>("创作成果");
  const [tags, setTags] = useState<string>("原创, 成稿");
  const [loadingKbs, setLoadingKbs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<{ id: string; kbId: string } | null>(null);

  // 可选的版本列表
  const availableVersions: { key: string; name: string; content: string }[] = [
    { key: "master", name: "成稿母稿", content: masterContent },
  ];
  Object.entries(variants).forEach(([k, v]) => {
    if (v && v.trim()) {
      availableVersions.push({
        key: k,
        name: PLATFORM_NAMES[k] || k,
        content: v,
      });
    }
  });
  if (availableVersions.length > 1) {
    availableVersions.push({
      key: "bundle",
      name: "全平台合辑打包",
      content: "", // 动态生成
    });
  }

  useEffect(() => {
    if (!open) {
      setSavedNote(null);
      return;
    }

    setSelectedVersion(initialPlatform);
    setCategory("创作成果");

    // 默认标题
    const platName = initialPlatform !== "master" ? ` · ${PLATFORM_NAMES[initialPlatform] || ""}` : "";
    setTitle(`${defaultTitle || "未命名作品"}${platName}`);

    // 拉取知识库列表
    setLoadingKbs(true);
    fetch("/api/kbs")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.kbs && Array.isArray(data.kbs)) {
          setKbs(data.kbs);
          const def = data.kbs.find((k: KnowledgeBase) => k.isDefault) || data.kbs[0];
          if (def) setSelectedKbId(def.id);
        }
      })
      .finally(() => setLoadingKbs(false));
  }, [open, defaultTitle, initialPlatform]);

  // 切换版本时更新默认标题与标签
  function handleVersionChange(verKey: string) {
    setSelectedVersion(verKey);
    const suffix =
      verKey === "master"
        ? ""
        : verKey === "bundle"
        ? " · 全平台合辑"
        : ` · ${PLATFORM_NAMES[verKey] || ""}`;
    setTitle(`${defaultTitle || "未命名作品"}${suffix}`);

    const baseTags = ["原创", "成稿"];
    if (verKey !== "master" && verKey !== "bundle" && PLATFORM_NAMES[verKey]) {
      baseTags.push(PLATFORM_NAMES[verKey].replace("版", ""));
    }
    setTags(baseTags.join(", "));
  }

  // 计算最终保存的正文内容
  function resolveFinalContent(): string {
    if (selectedVersion === "bundle") {
      let combined = `# ${defaultTitle || "创作作品合辑"}\n\n## ▎成稿母稿\n\n${masterContent}\n\n`;
      Object.entries(variants).forEach(([k, v]) => {
        if (v && v.trim()) {
          combined += `## ▎${PLATFORM_NAMES[k] || k}\n\n${v}\n\n`;
        }
      });
      return combined.trim();
    }
    const matched = availableVersions.find((v) => v.key === selectedVersion);
    return matched ? matched.content : masterContent;
  }

  async function handleSave() {
    const finalContent = resolveFinalContent();
    if (!finalContent.trim()) return;

    setSaving(true);
    try {
      const parsedTags = tags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kbId: selectedKbId,
          title: title.trim() || defaultTitle || "未命名作品",
          content: finalContent,
          category: category.trim() || "创作成果",
          tags: parsedTags,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const noteId = data.note?.id;
        setSavedNote({ id: noteId, kbId: selectedKbId });
        if (noteId && onSaved) {
          onSaved(noteId);
        }
      }
    } catch (err) {
      console.error("保存至知识库失败:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderPlus className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">沉淀保存至知识库</DialogTitle>
              <DialogDescription className="text-xs">
                将作品归档为知识库笔记，系统将自动萃取观点微粒并建立全文索引。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {savedNote ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Check className="size-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">成功沉淀至知识库！</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                已写入知识库，后台正在自动萃取观点微粒（用于后续全库淘金与论据匹配）。
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={() => {
                  window.open(`/knowledge/${savedNote.kbId}`, "_blank");
                }}
              >
                前往知识库查看
                <ExternalLink className="size-3 ml-0.5" />
              </Button>
              <Button
                size="sm"
                className="text-xs"
                onClick={() => onOpenChange(false)}
              >
                完成
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-xs">
            {/* 归档内容版本选择 */}
            {availableVersions.length > 1 && (
              <div className="space-y-1.5">
                <label className="font-medium text-muted-foreground flex items-center gap-1">
                  <Layers className="size-3" />
                  <span>选择归档版本：</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {availableVersions.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => handleVersionChange(v.key)}
                      className={`flex flex-col items-start rounded-lg border p-2 text-left transition-all ${
                        selectedVersion === v.key
                          ? "border-primary bg-primary/[0.04] text-foreground font-semibold shadow-2xs"
                          : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <span className="truncate w-full">{v.name}</span>
                      <span className="text-[10px] text-muted-foreground/80 font-normal">
                        {v.key === "bundle" ? "合辑沉淀" : `${v.content.length} 字`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 目标知识库 */}
            <div className="space-y-1.5">
              <label className="font-medium text-muted-foreground flex items-center gap-1">
                <Folder className="size-3" />
                <span>目标知识库：</span>
              </label>
              {loadingKbs ? (
                <div className="flex h-9 items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>加载知识库中...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {kbs.map((kb) => (
                    <button
                      key={kb.id}
                      type="button"
                      onClick={() => setSelectedKbId(kb.id)}
                      className={`flex items-center justify-between rounded-lg border p-2.5 text-left transition-all ${
                        selectedKbId === kb.id
                          ? "border-primary bg-primary/[0.04] text-foreground font-semibold shadow-2xs"
                          : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <div className="truncate">
                        <div className="truncate text-xs">{kb.name}</div>
                        {kb.description && (
                          <div className="truncate text-[10px] text-muted-foreground font-normal">
                            {kb.description}
                          </div>
                        )}
                      </div>
                      {kb.isDefault && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          默认
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 笔记标题 */}
            <div className="space-y-1.5">
              <label className="font-medium text-muted-foreground">笔记标题：</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入笔记标题"
                className="text-xs h-8"
              />
            </div>

            {/* 分类与标签 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="font-medium text-muted-foreground">分类：</label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="如：创作成果、原创长文"
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-medium text-muted-foreground">标签（逗号分隔）：</label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="原创, 成稿, 公众号"
                  className="text-xs h-8"
                />
              </div>
            </div>

            {/* 底部动作 */}
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="size-3 text-amber-500" />
                <span>入库将自动提炼观点微粒</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-xs h-8"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !title.trim() || !resolveFinalContent().trim()}
                  className="text-xs h-8 gap-1.5 font-semibold bg-foreground text-background hover:bg-foreground/90"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <FolderPlus className="size-3.5" />}
                  {saving ? "正在归档..." : "确认沉淀入库"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
