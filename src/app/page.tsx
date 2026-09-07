"use client";

import {
  ArrowUpDown,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Copy,
  Download,
  Edit3,
  FolderInput,
  Inbox,
  Link2,
  ListChecks,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { MoveNotesDialog } from "./knowledge/move-notes-dialog";
import { ImportDialog } from "./knowledge/import-dialog";
import { LinkDialog } from "./knowledge/link-dialog";
import type { KnowledgeBase, NoteItem, NotesResponse } from "@/lib/types";

function subscribeNoop() {
  return () => {};
}

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<NotesResponse | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [linkOpen, setLinkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Selection to Pipeline
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [sendingToWorkshop, setSendingToWorkshop] = useState(false);

  // 列表工具：多选模式 / 来源筛选 / 排序
  const [selectMode, setSelectMode] = useState(false);
  const [filterKb, setFilterKb] = useState<string>("all");
  const [openMenu, setOpenMenu] = useState<"filter" | "sort" | null>(null);
  const [sortKey, setSortKey] = useState<"created" | "updated">("created");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // 点击外部关闭筛选/排序弹出面板
  useEffect(() => {
    if (!openMenu) return;
    function handleClose() {
      setOpenMenu(null);
    }
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [openMenu]);

  // 平台快捷键提示：客户端挂载后检测 Mac/Windows
  const [modKey, setModKey] = useState("Ctrl / ⌘");
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setModKey(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/notes")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json) setData(json);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function fetchNotes() {
    try {
      const res = await fetch("/api/notes");
      if (res.ok) {
        const json: NotesResponse = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    }
  }

  async function submitQuickNote() {
    const text = content.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        setContent("");
        fetchNotes();
        setTimeout(fetchNotes, 6000);
      } else {
        const json = await res.json().catch(() => null);
        setError(json?.error || "入库失败");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSendToWorkshop() {
    if (selectedNoteIds.size === 0 || sendingToWorkshop) return;
    setSendingToWorkshop(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `装配项目 · 挂载 ${selectedNoteIds.size} 篇原料`,
          itemIds: Array.from(selectedNoteIds),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.project?.id) {
          router.push(`/workshop?projectId=${data.project.id}`);
        }
      }
    } finally {
      setSendingToWorkshop(false);
    }
  }

  const allNotes = data?.notes || [];
  const kbs = data?.kbs || [];

  const filteredNotes = (() => {
    const byKb = allNotes.filter(
      (n) => filterKb === "all" || (n.kbId || "default") === filterKb
    );

    const ts = (raw?: string) => {
      if (!raw) return 0;
      const d = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    };
    const keyOf = (n: NoteItem) =>
      sortKey === "updated" ? ts(n.updatedAt || n.createdAt) : ts(n.createdAt);

    return [...byKb].sort((a, b) =>
      sortDir === "asc" ? keyOf(a) - keyOf(b) : keyOf(b) - keyOf(a)
    );
  })();

  // 分页加载：默认显示 10 条，点击「显示更多」追加
  const PAGE_SIZE = 10;
  const filterSig = `${filterKb}|${sortKey}|${sortDir}`;
  const [pager, setPager] = useState({ sig: filterSig, count: PAGE_SIZE });
  if (pager.sig !== filterSig) {
    // 筛选/排序变化时重置分页（渲染期派生状态重置）
    setPager({ sig: filterSig, count: PAGE_SIZE });
  }
  const visibleCount = pager.sig === filterSig ? pager.count : PAGE_SIZE;
  const visibleNotes = filteredNotes.slice(0, visibleCount);
  const hasMoreNotes = visibleNotes.length < filteredNotes.length;

  function loadMoreNotes() {
    setPager((p) => ({
      sig: filterSig,
      count: (p.sig === filterSig ? p.count : PAGE_SIZE) + PAGE_SIZE,
    }));
  }

  // 各知识库的笔记数（供筛选面板展示）
  const kbCounts = new Map<string, number>();
  for (const n of allNotes) {
    const kb = n.kbId || "default";
    kbCounts.set(kb, (kbCounts.get(kb) || 0) + 1);
  }

  function toggleSelectMode() {
    setSelectMode((prev) => {
      if (prev) setSelectedNoteIds(new Set());
      return !prev;
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-8 py-8 pb-28">
      {/* 顶部主速记录入框 */}
      <div className="group rounded-xl border bg-card p-4 shadow-xs transition-all focus-within:border-foreground/30 focus-within:shadow-md">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submitQuickNote();
            }
          }}
          placeholder={`记录现在的想法... 支持 Markdown 语法，按 ${modKey} + Enter 秒级入库`}
          className="min-h-24 resize-y border-0 p-0 shadow-none focus-visible:ring-0 text-sm leading-relaxed placeholder:text-muted-foreground/70"
        />

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <kbd className="inline-flex items-center gap-0.5 rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">
              {modKey} + ↵
            </kbd>
            <span>快捷入库</span>
          </div>

          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-destructive">{error}</span>}
            {content.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">{content.length} 字</span>
            )}
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-md px-3 text-xs font-semibold shadow-xs"
              disabled={!content.trim() || submitting}
              onClick={submitQuickNote}
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <span>入库</span>
                  <Send className="size-3" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* “你还可以” 快捷卡片区 */}
      <div className="space-y-2.5">
        <div className="text-xs font-medium text-muted-foreground">快速导入与剪藏</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {/* 添加链接卡片 */}
          <button
            onClick={() => setLinkOpen(true)}
            className="group flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all hover:border-foreground/30 hover:shadow-xs"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 transition-colors group-hover:bg-blue-500/20">
              <Link2 className="size-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">网页链接剪藏</div>
              <div className="text-[11px] text-muted-foreground">AI 智能提取正文与分块</div>
            </div>
          </button>

          {/* 导入文档卡片 */}
          <button
            onClick={() => setImportOpen(true)}
            className="group flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all hover:border-foreground/30 hover:shadow-xs"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 transition-colors group-hover:bg-purple-500/20">
              <Upload className="size-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">导入本地文档</div>
              <div className="text-[11px] text-muted-foreground">支持 Markdown / PDF / TXT</div>
            </div>
          </button>
        </div>
      </div>

      {/* 笔记信息流 */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">时间流笔记</span>
            <Badge variant="secondary" className="text-xs font-normal tabular-nums">
              {hasMoreNotes
                ? `${visibleNotes.length} / ${filteredNotes.length}`
                : filteredNotes.length}
            </Badge>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground"
              onClick={fetchNotes}
              title="刷新笔记"
            >
              <RefreshCw className="size-3" />
            </Button>
          </div>

        <div className="flex items-center gap-1">
          {/* 多选模式 */}
          <Button
            variant="ghost"
            size="icon-xs"
            className={`size-7 rounded-md transition-colors ${
              selectMode
                ? "bg-foreground text-background hover:bg-foreground hover:text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title={selectMode ? "退出多选" : "多选模式（常显勾选框）"}
            onClick={toggleSelectMode}
          >
            <ListChecks className="size-4" />
          </Button>

          {/* 来源筛选 */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon-xs"
              className={`size-7 rounded-md transition-colors ${
                filterKb !== "all" || openMenu === "filter"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="按知识库筛选"
              onClick={() => setOpenMenu((prev) => (prev === "filter" ? null : "filter"))}
            >
              <SlidersHorizontal className="size-4" />
            </Button>

            {openMenu === "filter" && (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-44 overflow-hidden rounded-lg border bg-popover/95 p-1 shadow-xl backdrop-blur-md ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100 text-xs">
                <div className="px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">
                  按来源知识库筛选
                </div>
                <button
                  onClick={() => {
                    setFilterKb("all");
                    setOpenMenu(null);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-foreground transition-colors hover:bg-muted"
                >
                  <span className={filterKb === "all" ? "font-semibold" : ""}>全部知识库</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {allNotes.length}
                    {filterKb === "all" && <Check className="size-3 text-primary" />}
                  </span>
                </button>
                {kbs
                  .filter((k) => kbCounts.has(k.id))
                  .map((k) => (
                    <button
                      key={k.id}
                      onClick={() => {
                        setFilterKb(k.id);
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-foreground transition-colors hover:bg-muted"
                    >
                      <span className={`truncate ${filterKb === k.id ? "font-semibold" : ""}`}>
                        {k.name}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        {kbCounts.get(k.id) || 0}
                        {filterKb === k.id && <Check className="size-3 text-primary" />}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* 排序 */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon-xs"
              className={`size-7 rounded-md transition-colors ${
                openMenu === "sort"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="排序"
              onClick={() => setOpenMenu((prev) => (prev === "sort" ? null : "sort"))}
            >
              <ArrowUpDown className="size-4" />
            </Button>

            {openMenu === "sort" && (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-48 overflow-hidden rounded-lg border bg-popover/95 p-1 shadow-xl backdrop-blur-md ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100 text-xs">
                <div className="px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">
                  排序方式
                </div>
                {([
                  { key: "created" as const, dir: "desc" as const, label: "创建时间 · 从近到远" },
                  { key: "created" as const, dir: "asc" as const, label: "创建时间 · 从远到近" },
                  { key: "updated" as const, dir: "desc" as const, label: "修改时间 · 从近到远" },
                  { key: "updated" as const, dir: "asc" as const, label: "修改时间 · 从远到近" },
                ]).map((opt) => {
                  const active = sortKey === opt.key && sortDir === opt.dir;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => {
                        setSortKey(opt.key);
                        setSortDir(opt.dir);
                        setOpenMenu(null);
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-foreground transition-colors hover:bg-muted"
                    >
                      <span className={active ? "font-semibold" : ""}>{opt.label}</span>
                      {active && <Check className="size-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

        {visibleNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2 rounded-xl border border-dashed">
            <Inbox className="size-8 text-muted-foreground/30" />
            <p className="text-xs font-medium">还没有记录任何笔记</p>
            <p className="text-[11px] text-muted-foreground/70">
              在上方记录第一句想法，或点击快捷卡片导入。
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleNotes.map((note) => (
              <HomeNoteCard
                key={note.id}
                note={note}
                kbs={kbs}
                selected={selectedNoteIds.has(note.id)}
                selectMode={selectMode}
                onToggleSelect={() => toggleSelect(note.id)}
                onDeleted={fetchNotes}
              />
            ))}
          </div>
        )}

        {/* 加载更多 */}
        {hasMoreNotes && (
          <div className="flex items-center justify-center py-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full px-4 text-xs text-muted-foreground shadow-xs hover:text-foreground"
              onClick={loadMoreNotes}
            >
              显示更多
              <span className="tabular-nums text-[10px] opacity-70">
                剩余 {filteredNotes.length - visibleNotes.length} 条
              </span>
            </Button>
          </div>
        )}
      </div>

      {/* 浮动操作栏：送入工坊 */}
      {selectedNoteIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-full border bg-popover px-4 py-2 shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95">
          <span className="text-xs font-medium text-foreground">
            已勾选 <span className="font-bold text-primary">{selectedNoteIds.size}</span> 篇原料
          </span>
          <Button
            size="sm"
            className="h-7 gap-1.5 rounded-full px-3 text-xs font-semibold shadow-xs"
            onClick={handleSendToWorkshop}
            disabled={sendingToWorkshop}
          >
            <Zap className="size-3.5" />
            <span>送入装配工坊</span>
            <ArrowRight className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedNoteIds(new Set())}
          >
            取消
          </Button>
        </div>
      )}

      {/* 弹窗 */}
      <LinkDialog open={linkOpen} onOpenChange={setLinkOpen} onCreated={fetchNotes} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onCreated={fetchNotes} />
    </div>
  );
}

function HomeNoteCard({
  note,
  kbs,
  selected,
  selectMode,
  onToggleSelect,
  onDeleted,
}: {
  note: NoteItem;
  kbs: KnowledgeBase[];
  selected: boolean;
  selectMode: boolean;
  onToggleSelect: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  // 菜单打开时点击外部关闭（并复位删除确认态）
  useEffect(() => {
    if (!menuOpen) return;
    function handleClose() {
      setMenuOpen(false);
      setArmed(false);
    }
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [menuOpen]);

  function openInEditor() {
    router.push(`/knowledge/${note.kbId || "default"}?note=${note.id}`);
  }

  function copyContent() {
    navigator.clipboard.writeText(note.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function exportMarkdown() {
    const title = note.title || "未命名笔记";
    const blob = new Blob([note.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function remove() {
    await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
    onDeleted();
  }

  return (
    <div
      onClick={openInEditor}
      className={`group relative flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-all ${
        selected ? "border-primary/50 bg-primary/[0.03] shadow-xs" : "bg-card hover:border-foreground/20 hover:shadow-xs"
      }`}
    >
      {(selectMode || selected) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center"
          title={selected ? "取消勾选" : "勾选送入工坊"}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            className="mt-1"
          />
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1.5">
        {note.title && (
          <div className="pr-8 text-lg font-semibold text-foreground leading-snug">
            {note.title}
          </div>
        )}

        <p className="line-clamp-3 font-sans text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {note.content}
        </p>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground pt-0.5">
          {(() => {
            const kb = kbs.find((k) => k.id === (note.kbId || "default"));
            return kb ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
                <BookOpen className="size-2.5" />
                {kb.name}
              </span>
            ) : null;
          })()}
          {(note.tags || []).map((t) => (
            <span
              key={t}
              className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] leading-none text-muted-foreground"
            >
              {t}
            </span>
          ))}
          <span className="ml-auto text-[11px] flex items-center gap-1 text-muted-foreground/75">
            <Clock className="size-3 text-muted-foreground/50" />
            {formatTime(note.createdAt)}
          </span>
        </div>
      </div>

      {/* 右上三点操作菜单（绝对定位，不挤占正文宽度） */}
      <div
        className="absolute right-3 top-3"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          className={`size-6 shrink-0 rounded-md text-muted-foreground transition-opacity hover:text-foreground hover:bg-muted ${
            menuOpen ? "opacity-100 bg-muted text-foreground" : "opacity-0 group-hover:opacity-100"
          }`}
          title="更多操作"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-30 w-36 overflow-hidden rounded-lg border bg-popover/95 p-1 shadow-xl backdrop-blur-md ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100 text-xs">
            <button
              onClick={copyContent}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5 text-muted-foreground" />}
              <span>{copied ? "已复制" : "复制"}</span>
            </button>

            <button
              onClick={openInEditor}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
            >
              <Edit3 className="size-3.5 text-muted-foreground" />
              <span>编辑</span>
            </button>

            <button
              onClick={() => {
                setMenuOpen(false);
                setMoveOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
            >
              <FolderInput className="size-3.5 text-muted-foreground" />
              <span>添加到知识库</span>
            </button>

            <button
              onClick={exportMarkdown}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
            >
              <Download className="size-3.5 text-muted-foreground" />
              <span>导出</span>
            </button>

            <div className="my-0.5 h-px bg-border/60" />

            <button
              onClick={() => (armed ? void remove() : setArmed(true))}
              onMouseLeave={() => setArmed(false)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                armed
                  ? "font-semibold text-destructive hover:bg-destructive/10"
                  : "text-foreground hover:bg-destructive/10 hover:text-destructive"
              }`}
            >
              <Trash2 className="size-3.5" />
              <span>{armed ? "再次点击确认删除" : "删除"}</span>
            </button>
          </div>
        )}
      </div>

      <MoveNotesDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        noteIds={[note.id]}
        kbs={kbs}
        currentKbId={note.kbId || "default"}
        onMoved={onDeleted}
      />
    </div>
  );
}

function formatTime(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return raw;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60 && diffSecs >= 0) {
    return "刚刚";
  }
  if (diffMins < 60 && diffMins > 0) {
    return `${diffMins} 分钟前`;
  }
  if (diffHours < 24 && diffHours > 0) {
    return `${diffHours} 小时前`;
  }
  if (diffDays === 1) {
    return "昨天";
  }
  if (diffDays < 7 && diffDays > 1) {
    return `${diffDays} 天前`;
  }

  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
