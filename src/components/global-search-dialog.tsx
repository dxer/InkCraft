"use client";

import { useEffect, useState, useTransition } from "react";
import {
  BookOpen,
  FileText,
  Library,
  Loader2,
  Search,
  Sparkles,
  Tag,
  X,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StageBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeBase, NoteItem } from "@/lib/types";

interface SearchWork {
  id: string;
  title: string;
  currentStage: string;
  wordCount: number;
  updatedAt: string;
}

interface SearchNoteWithKb extends NoteItem {
  kbName?: string;
  snippet?: string | null;
}

interface SearchResult {
  notes: SearchNoteWithKb[];
  kbs: KnowledgeBase[];
  works: SearchWork[];
  total: number;
}

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "notes" | "kbs" | "works">("all");
  const [results, setResults] = useState<SearchResult>({
    notes: [],
    kbs: [],
    works: [],
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  // 监听全局快捷键 Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // 仅在用户输入搜索词时触发搜索
  useEffect(() => {
    const trimmed = query.trim();
    if (!open || !trimmed) return;

    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data) => {
          if (active) {
            setResults({
              notes: data.notes || [],
              kbs: data.kbs || [],
              works: data.works || [],
              total: data.total || 0,
            });
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setQuery("");
      setResults({ notes: [], kbs: [], works: [], total: 0 });
      setActiveTab("all");
    }
    onOpenChange(v);
  };

  const handleOpenKb = (kbId: string) => {
    window.open(`/knowledge/${kbId}`, "_blank");
    handleOpenChange(false);
  };

  const handleOpenWork = (workId: string) => {
    startTransition(() => {
      router.push(`/workshop?project=${workId}`);
      handleOpenChange(false);
    });
  };

  const handleOpenNote = (note: SearchNoteWithKb) => {
    const targetKb = note.kbId || "default";
    window.open(`/knowledge/${targetKb}?note=${note.id}`, "_blank");
    handleOpenChange(false);
  };

  const hasQuery = query.trim().length > 0;
  const currentResults = hasQuery
    ? results
    : { notes: [], kbs: [], works: [], total: 0 };

  const showNotes = activeTab === "all" || activeTab === "notes";
  const showKbs = activeTab === "all" || activeTab === "kbs";
  const showWorks = activeTab === "all" || activeTab === "works";

  const hasAnyResults =
    (showKbs && currentResults.kbs.length > 0) ||
    (showNotes && currentResults.notes.length > 0) ||
    (showWorks && currentResults.works.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-full sm:max-w-3xl md:max-w-3xl overflow-hidden p-0 gap-0 rounded-xl shadow-2xl border bg-background"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>全局搜索</DialogTitle>
        </DialogHeader>

        {/* 顶部搜索输入栏 */}
        <div className="flex items-center border-b px-5 py-4 gap-3 bg-muted/10">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索笔记正文、知识库、已成文稿成果..."
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
          />
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {query && !loading && (
            <button
              onClick={() => {
                setQuery("");
                setResults({ notes: [], kbs: [], works: [], total: 0 });
              }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <X className="size-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5.5 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[11px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* 仅在有输入内容时展示分类过滤 Tab */}
        {hasQuery && (
          <div className="flex items-center gap-1.5 border-b bg-muted/25 px-5 py-2 text-xs">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                activeTab === "all"
                  ? "bg-background font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              全部 ({currentResults.total})
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                activeTab === "notes"
                  ? "bg-background font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="size-3" />
              <span>笔记 ({currentResults.notes.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("kbs")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                activeTab === "kbs"
                  ? "bg-background font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="size-3" />
              <span>知识库 ({currentResults.kbs.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("works")}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                activeTab === "works"
                  ? "bg-background font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Library className="size-3" />
              <span>成果 ({currentResults.works.length})</span>
            </button>
          </div>
        )}

        {/* 搜索结果区域 */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {/* 默认打开且未输入任何内容状态：展示简洁提示，不展示列表内容 */}
          {!hasQuery && (
            <div className="py-12 text-center space-y-3">
              <Search className="size-9 mx-auto text-muted-foreground/30" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">输入关键词开始全库检索</p>
                <p className="text-xs text-muted-foreground">
                  支持实时匹配笔记内容、知识库专题与已成文稿成果
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-1">📝 笔记原料</span>
                <span className="rounded-md bg-muted px-2 py-1">📚 专属知识库</span>
                <span className="rounded-md bg-muted px-2 py-1">🏆 创作作品</span>
              </div>
            </div>
          )}

          {/* 输入了搜索词但没有匹配结果 */}
          {hasQuery && !hasAnyResults && !loading && (
            <div className="py-14 text-center text-muted-foreground space-y-2">
              <Search className="size-8 mx-auto text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">未找到与 &quot;{query}&quot; 相关的内容</p>
              <p className="text-xs text-muted-foreground/70">
                请检查错别字或尝试更通用的关键词
              </p>
            </div>
          )}

          {/* 匹配到的知识库分组 */}
          {hasQuery && showKbs && currentResults.kbs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
                <BookOpen className="size-3.5 text-primary" />
                <span>知识库 ({currentResults.kbs.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentResults.kbs.map((kb) => (
                  <div
                    key={kb.id}
                    onClick={() => handleOpenKb(kb.id)}
                    className="group flex cursor-pointer items-start justify-between gap-3 rounded-xl border bg-card p-3.5 transition-all hover:border-foreground/30 hover:shadow-xs active:scale-[0.99]"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {kb.name}
                        </span>
                        {kb.isDefault && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            默认
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {kb.description || "暂无描述"}
                      </p>
                      <div className="text-[11px] text-muted-foreground/80 font-medium">
                        {kb.notesCount || 0} 篇笔记
                      </div>
                    </div>
                    <ExternalLink className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 匹配到的成果作品分组 */}
          {hasQuery && showWorks && currentResults.works.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                <span>创作成果 ({currentResults.works.length})</span>
              </div>
              <div className="space-y-1.5">
                {currentResults.works.map((work) => (
                  <div
                    key={work.id}
                    onClick={() => handleOpenWork(work.id)}
                    className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-all hover:border-foreground/30 hover:bg-muted/20 active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {work.title}
                        </span>
                        <StageBadge stage={work.currentStage} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>约 {work.wordCount} 字</span>
                        <span>{new Date(work.updatedAt).toLocaleDateString("zh-CN")}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground flex items-center gap-1 shrink-0 font-medium">
                      进入工坊 →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 匹配到的笔记分组 */}
          {hasQuery && showNotes && currentResults.notes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
                <FileText className="size-3.5 text-primary" />
                <span>笔记条目 ({currentResults.notes.length})</span>
              </div>
              <div className="space-y-2">
                {currentResults.notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => handleOpenNote(note)}
                    className="group flex cursor-pointer items-start justify-between gap-3 rounded-xl border bg-card p-3.5 transition-all hover:border-foreground/30 hover:bg-muted/20 active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {note.title || "未命名笔记"}
                        </span>
                        {note.kbName && (
                          <span className="text-[10px] text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded shrink-0">
                            {note.kbName}
                          </span>
                        )}
                      </div>

                      {note.snippet ? (
                        <div
                          className="text-xs text-muted-foreground line-clamp-2 leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: note.snippet.replace(/【/g, '<span class="text-primary font-bold">').replace(/】/g, '</span>'),
                          }}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {note.content}
                        </p>
                      )}

                      {note.tags && note.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {note.tags.slice(0, 4).map((tag, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/80 bg-muted px-1.5 py-0.2 rounded"
                            >
                              <Tag className="size-2.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <ExternalLink className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部快捷键提示 */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-2.5 text-[11px] text-muted-foreground">
          <span>点击直接在新窗口或工坊中打开对应条目</span>
          <div className="flex items-center gap-2">
            <span>快捷唤出</span>
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl+K / ⌘K
            </kbd>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
