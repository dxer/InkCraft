"use client";

import {
  ArrowDownUp,
  Check,
  ChevronDown,
  FileCode,
  FileText,
  Folder,
  FolderPlus,
  FolderInput,
  IdCard,
  Link2,
  ListChecks,
  Loader2,
  Microscope,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Send,
  ShieldQuestion,
  Sparkles,
  Sprout,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { InkCraftMark } from "@/components/logo";
import { Textarea } from "@/components/ui/textarea";
import { DeleteNotesDialog } from "../delete-notes-dialog";
import { EditKbDialog } from "../edit-kb-dialog";
import { EditNoteDialog } from "../edit-note-dialog";
import { ImportDialog } from "../import-dialog";
import { LinkDialog } from "../link-dialog";
import { MoveNotesDialog } from "../move-notes-dialog";
import { NewKbDialog } from "../new-kb-dialog";
import { NoteListItem } from "../note-list-item";
import { SproutPanel } from "../sprout-panel";
import { NoteCardsPanel } from "../note-cards-panel";
import type { SproutResult } from "@/lib/sprout";
import type { KnowledgeBase, KnowledgeCard, NoteItem } from "@/lib/types";

export default function KnowledgeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [allKbs, setAllKbs] = useState<KnowledgeBase[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 侧边栏收起状态
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  // 选中的当前笔记
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // 行内添加标签输入状态
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");

  // AI 智能标签推荐面板状态
  const [smartTagsOpen, setSmartTagsOpen] = useState(false);
  const [smartTagsLoading, setSmartTagsLoading] = useState(false);
  const [smartTags, setSmartTags] = useState<string[]>([]);

  // 多选状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    new Set(),
  );

  // 过滤器与排序
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "title">(
    "newest",
  );
  const [activeTab, setActiveTab] = useState<"content" | "sprout">("content");

  // AI 问答面板
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAsking, setAiAsking] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);

  // 智鉴 (知识发芽) 档案
  const [sprout, setSprout] = useState<SproutResult | null>(null);
  const [sproutLoading, setSproutLoading] = useState(false);
  const [reSprouting, setReSprouting] = useState(false);

  // 对应笔记的原子知识卡片列表与加载状态
  const [noteCards, setNoteCards] = useState<KnowledgeCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardExtracting, setCardExtracting] = useState(false);
  const [cardResult, setCardResult] = useState<string | null>(null);

  // 单个笔记 3 点操作菜单打开的 noteId
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null);

  // 知识库切换下拉面板状态与搜索
  const [kbDropdownOpen, setKbDropdownOpen] = useState(false);
  const [kbSearchQuery, setKbSearchQuery] = useState("");
  const [editKbDialogOpen, setEditKbDialogOpen] = useState(false);

  // 顶部 + 号添加下拉菜单
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  // 弹窗状态
  const [linkOpen, setLinkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newKbOpen, setNewKbOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<NoteItem | null>(null);
  const [movingNoteIds, setMovingNoteIds] = useState<string[]>([]);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  const mdFileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  // 删除确认对话框状态
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    count: number;
    title?: string;
    action: () => Promise<void>;
  }>({
    open: false,
    count: 0,
    action: async () => {},
  });

  // 从首页点击笔记跳转携带的 ?note= 定位参数，仅在首次加载时消费一次
  const noteParamConsumedRef = useRef(false);

  const fetchKbAndNotes = useCallback(async () => {
    try {
      const [kbsRes, notesRes] = await Promise.all([
        fetch("/api/kbs"),
        fetch(`/api/notes?kb_id=${kbId}`),
      ]);

      if (kbsRes.ok) {
        const kData = await kbsRes.json();
        const loadedKbs = kData.kbs || [];
        setAllKbs(loadedKbs);
        const found = loadedKbs.find((k: KnowledgeBase) => k.id === kbId);
        setKb(
          found || {
            id: kbId,
            name: "知识库",
            description: "",
            isDefault: false,
            notesCount: 0,
            createdAt: "",
          },
        );
      }

      if (notesRes.ok) {
        const nData = await notesRes.json();
        const loadedNotes: NoteItem[] = nData.notes || [];
        setNotes(loadedNotes);
        if (loadedNotes.length > 0 && !selectedNote) {
          let target = loadedNotes[0];
          if (!noteParamConsumedRef.current) {
            noteParamConsumedRef.current = true;
            const noteParam = new URLSearchParams(window.location.search).get(
              "note",
            );
            const matched = noteParam
              ? loadedNotes.find((n) => n.id === noteParam)
              : null;
            if (matched) target = matched;
          }
          setSelectedNote(target);
          setEditingTitle(target.title || "");
          setEditingContent(target.content || "");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [kbId, selectedNote]);

  useEffect(() => {
    fetchKbAndNotes();
  }, [fetchKbAndNotes]);

  // 点击外部关闭弹出菜单与知识库下拉面板
  useEffect(() => {
    function handleClickOutside() {
      setMenuNoteId(null);
      setAddMenuOpen(false);
      setKbDropdownOpen(false);
      setIsAddingTag(false);
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // 切换笔记时拉取智鉴发芽档案
  useEffect(() => {
    if (!selectedNote) return;
    let cancelled = false;
    // setState 放入宏任务回调，避免同步 setState 引发级联渲染（react-hooks/set-state-in-effect）
    const loadingTimer = setTimeout(() => {
      if (!cancelled) setSproutLoading(true);
    }, 0);

    fetch(`/api/insights/extraction?noteId=${selectedNote.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && (data?.sprout || data?.extraction)) {
          setSprout(data.sprout || data.extraction);
        } else if (!cancelled) {
          setSprout(null);
        }
      })
      .catch(() => {
        if (!cancelled) setSprout(null);
      })
      .finally(() => {
        if (!cancelled) setSproutLoading(false);
        cancelled = true; // 标记本轮回合结束，避免未触发的 loadingTimer 再置位
      });

    return () => {
      cancelled = true;
      clearTimeout(loadingTimer);
    };
  }, [selectedNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 手动重新执行智鉴发芽
  async function handleReSprout() {
    if (!selectedNote || reSprouting) return;
    setReSprouting(true);
    try {
      const res = await fetch("/api/insights/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: selectedNote.id,
          content: editingContent || selectedNote.content,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.sprout || data?.extraction) {
          setSprout(data.sprout || data.extraction);
        }
      }
    } catch (err) {
      console.error("智鉴发芽失败:", err);
    } finally {
      setReSprouting(false);
    }
  }

  // 加载当前选中笔记的知识卡片列表
  const fetchNoteCards = useCallback(async (docId: string) => {
    if (!docId) return;
    setCardsLoading(true);
    try {
      const res = await fetch(`/api/cards?doc_id=${docId}`);
      if (res.ok) {
        const data = await res.json();
        setNoteCards(data.cards || []);
      }
    } catch (err) {
      console.error("加载笔记对应卡片失败:", err);
    } finally {
      setCardsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedNote?.id) {
      fetchNoteCards(selectedNote.id);
    } else {
      setNoteCards([]);
    }
  }, [selectedNote?.id, fetchNoteCards]);

  // 生成 / 重新生成知识卡片（入库时已自动萃取，这里可手动刷新）
  async function handleGenerateCard() {
    if (!selectedNote || cardExtracting) return;
    setCardExtracting(true);
    setCardResult(null);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docIds: [selectedNote.id] }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setCardResult(`卡片已${data?.reextracted ? "重新生成" : "生成"}`);
        fetchNoteCards(selectedNote.id);
      } else {
        setCardResult("卡片生成失败，请稍后重试");
      }
    } catch {
      setCardResult("卡片生成失败，请检查模型配置");
    } finally {
      setCardExtracting(false);
      setTimeout(() => setCardResult(null), 3000);
    }
  }

  // 将智鉴发芽大纲与关联素材一键送入工坊装配流
  function handleSendSproutToWorkshop(sproutData: SproutResult) {
    if (!selectedNote) return;
    const materialIds = [
      selectedNote.id,
      ...sproutData.material_mappings.map((m) => m.documentId).filter(Boolean),
    ];
    const convertedTopic = {
      title: sproutData.expanded_outline.title,
      angle: sproutData.expanded_outline.takeaway || sproutData.seed_summary,
      outline: sproutData.expanded_outline.points,
    };
    try {
      sessionStorage.setItem(
        "inkcraft_pending_topic",
        JSON.stringify({
          topic: convertedTopic,
          materialId: selectedNote.id,
          materialIds: Array.from(new Set(materialIds)),
          materialTitle: selectedNote.title || "种子笔记",
        }),
      );
    } catch {
      // 隐私模式 / Storage 配额异常等场景下静默失败即可，不阻断进入工坊
    }
    router.push("/workshop");
  }

  // 选择切换笔记
  function selectNoteItem(note: NoteItem) {
    setSelectedNote(note);
    setEditingTitle(note.title || "");
    setEditingContent(note.content || "");
    setAiAnswer(null);
    setSmartTagsOpen(false);
    setIsAddingTag(false);
  }

  // 添加标签下拉面板：聚合当前知识库已有标签（供选择/搜索/创建）
  const knownTags = (() => {
    const counts = new Map<string, number>();
    for (const n of notes) {
      for (const t of n.tags || []) {
        const clean = t.replace(/^#/, "").trim();
        if (clean) counts.set(clean, (counts.get(clean) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  })();
  const noteTags = selectedNote?.tags || [];
  const currentTag = newTagInput.replace(/^#/, "").trim();
  const candidateTags = knownTags.filter(
    (t) =>
      !noteTags.includes(t.name) &&
      (!currentTag || t.name.toLowerCase().includes(currentTag.toLowerCase())),
  );

  // 1. 添加标签（下拉面板内：点选已有标签或创建新标签）
  async function handleAddTag(tagToAdd: string) {
    const cleanTag = tagToAdd.replace(/^#/, "").trim();
    if (!cleanTag || !selectedNote) return;

    const currentTags = selectedNote.tags || [];
    if (currentTags.includes(cleanTag)) {
      setNewTagInput("");
      return;
    }

    const nextTags = [...currentTags, cleanTag];
    setSelectedNote((prev) => (prev ? { ...prev, tags: nextTags } : null));
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedNote.id ? { ...n, tags: nextTags } : n,
      ),
    );
    setNewTagInput("");

    await fetch(`/api/notes/${selectedNote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: nextTags }),
    });
  }

  // 2. 行内移除标签
  async function handleRemoveTag(tagToRemove: string) {
    if (!selectedNote) return;
    const currentTags = selectedNote.tags || [];
    const nextTags = currentTags.filter((t) => t !== tagToRemove);

    setSelectedNote((prev) => (prev ? { ...prev, tags: nextTags } : null));
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedNote.id ? { ...n, tags: nextTags } : n,
      ),
    );

    await fetch(`/api/notes/${selectedNote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: nextTags }),
    });
  }

  // 3. 智能标签：调用 AI 提取推荐标签
  async function handleGenerateSmartTags() {
    if (!selectedNote) return;
    setSmartTagsOpen(true);
    setSmartTagsLoading(true);

    try {
      const res = await fetch("/api/notes/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingTitle || selectedNote.title || "",
          content: editingContent || selectedNote.content || "",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSmartTags(data.tags || []);
      }
    } finally {
      setSmartTagsLoading(false);
    }
  }

  // 一键采纳全部智能标签
  async function handleAcceptAllSmartTags() {
    if (!selectedNote || smartTags.length === 0) return;
    const currentTags = new Set(selectedNote.tags || []);
    for (const st of smartTags) {
      currentTags.add(st);
    }
    const nextTags = Array.from(currentTags);

    setSelectedNote((prev) => (prev ? { ...prev, tags: nextTags } : null));
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedNote.id ? { ...n, tags: nextTags } : n,
      ),
    );
    setSmartTagsOpen(false);

    await fetch(`/api/notes/${selectedNote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: nextTags }),
    });
  }

  // 新建空白笔记
  async function handleCreateBlankNote() {
    setAddMenuOpen(false);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "未命名笔记",
          content: "开始记录你的想法...",
          kbId: kbId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchKbAndNotes();
        selectNoteItem(data.note);
      }
    } catch {
      // ignore
    }
  }

  // 导入 Markdown 文件
  async function handleMdFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const title = file.name.replace(/\.[^.]+$/, "");
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: text,
          kbId: kbId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchKbAndNotes();
        selectNoteItem(data.note);
      }
    } finally {
      if (mdFileInputRef.current) mdFileInputRef.current.value = "";
    }
  }

  // 立即保存当前笔记（防抖自动保存与 Ctrl+S 共用）；无实质修改或内容为空时静默跳过
  const saveNote = useCallback(async () => {
    if (!selectedNote) return;
    const currentTitle = editingTitle.trim();
    const currentContent = editingContent.trim();
    const originalTitle = (selectedNote.title || "").trim();
    const originalContent = (selectedNote.content || "").trim();
    if (currentTitle === originalTitle && currentContent === originalContent)
      return;
    if (!currentContent) return;

    setSavingNote(true);
    setSavedSuccess(false);
    try {
      const res = await fetch(`/api/notes/${selectedNote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentTitle || null,
          content: currentContent,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedNote(data.note);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
        setNotes((prev) =>
          prev.map((n) => (n.id === selectedNote.id ? data.note : n)),
        );
      }
    } catch (err) {
      console.error("保存笔记失败:", err);
    } finally {
      setSavingNote(false);
    }
  }, [editingTitle, editingContent, selectedNote]);

  // 自动防抖保存笔记修改（用户输入时静默实时保存）
  useEffect(() => {
    if (!selectedNote) return;
    const currentTitle = editingTitle.trim();
    const currentContent = editingContent.trim();
    const originalTitle = (selectedNote.title || "").trim();
    const originalContent = (selectedNote.content || "").trim();

    // 未发生实质修改或内容为空时不触发
    if (currentTitle === originalTitle && currentContent === originalContent) {
      return;
    }
    if (!currentContent) return;

    const timer = setTimeout(() => {
      void saveNote();
    }, 800);

    return () => clearTimeout(timer);
  }, [editingTitle, editingContent, selectedNote?.id, saveNote]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl/Cmd+S 立即保存当前笔记（拦截浏览器默认保存对话框）
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNote();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNote]);

  // 标题过长自动换行：随内容与窗口宽度自适应高度（纯 DOM 调整，不触发 setState）
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [editingTitle, selectedNote?.id]);

  // 触发删除单篇笔记
  function triggerDeleteSingle(note: NoteItem, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuNoteId(null);
    setDeleteConfirm({
      open: true,
      count: 1,
      title: note.title || "未命名笔记",
      action: async () => {
        await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
        const remaining = notes.filter((n) => n.id !== note.id);
        setNotes(remaining);
        setSelectedNoteIds((prev) => {
          const next = new Set(prev);
          next.delete(note.id);
          return next;
        });

        if (selectedNote?.id === note.id) {
          if (remaining.length > 0) {
            selectNoteItem(remaining[0]);
          } else {
            setSelectedNote(null);
            setEditingTitle("");
            setEditingContent("");
          }
        }
      },
    });
  }

  // 触发批量删除
  function triggerBatchDelete() {
    if (selectedNoteIds.size === 0) return;
    setDeleteConfirm({
      open: true,
      count: selectedNoteIds.size,
      action: async () => {
        await Promise.all(
          Array.from(selectedNoteIds).map((id) =>
            fetch(`/api/notes/${id}`, { method: "DELETE" }),
          ),
        );

        const remaining = notes.filter((n) => !selectedNoteIds.has(n.id));
        setNotes(remaining);
        setSelectedNoteIds(new Set());

        if (selectedNote && selectedNoteIds.has(selectedNote.id)) {
          if (remaining.length > 0) {
            selectNoteItem(remaining[0]);
          } else {
            setSelectedNote(null);
            setEditingTitle("");
            setEditingContent("");
          }
        }
      },
    });
  }

  // 移出当前知识库（归集至默认主知识库）
  async function handleRemoveFromKb(noteId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuNoteId(null);
    await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kbId: "default" }),
    });
    fetchKbAndNotes();
  }

  // 导出笔记为 Markdown 文件
  function handleExportMarkdown(note: NoteItem, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuNoteId(null);
    const title = note.title || "未命名笔记";
    const blob = new Blob([note.content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 闪念成稿：以该素材为骨架直接创建起草工位项目，跳过选题与匹配两步
  async function handleQuickDraft(note: NoteItem, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuNoteId(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quickDraft: true, itemIds: [note.id] }),
      });
      if (res.ok) {
        const data = await res.json();
        // 携带 projectId 打开，确保工坊直接落位该项目的起草工位
        window.open(
          data?.project?.id
            ? `/workshop?projectId=${data.project.id}`
            : "/workshop",
          "_blank",
        );
      }
    } catch {
      // ignore
    }
  }

  // 多选切换
  function toggleNoteSelect(noteId: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }

  // AI 针对当前笔记提问/分析（action 对应智鉴四维度，默认精炼）
  async function handleAskAi(
    customPrompt?: string,
    action: "expand" | "challenge" | "assess" | "refine" = "refine",
  ) {
    const q = customPrompt || aiQuestion.trim();
    if (!q || !selectedNote || aiAsking) return;

    setAiAsking(true);
    setAiAnswer(null);

    try {
      const plainText = editingContent.slice(0, 1000);
      const res = await fetch("/api/workshop/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          selectedText: plainText,
          context: `用户指令：${q}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnswer(data.result);
      }
    } finally {
      setAiAsking(false);
    }
  }

  function handleSwitchKb(newId: string) {
    if (newId === kbId) return;
    router.push(`/knowledge/${newId}`);
  }

  const filteredNotes = notes
    .filter((n) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (n.title || "").toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortOrder === "newest") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (sortOrder === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      if (sortOrder === "title") {
        return (a.title || "").localeCompare(b.title || "", "zh-CN");
      }
      return 0;
    });

  const wordCount = editingContent.trim().length;

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-background">
      {/* 隐藏的 Markdown 文件直接上传 input */}
      <input
        type="file"
        ref={mdFileInputRef}
        onChange={handleMdFileChange}
        accept=".md,.markdown,.txt"
        className="hidden"
      />

      {/* 独立全屏窗口顶部导航条 */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4 bg-muted/15">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            title="回到首页"
            aria-label="回到首页"
            className="flex items-center gap-1.5 mr-1 rounded-md transition-colors hover:opacity-80"
          >
            <InkCraftMark className="size-7 shrink-0 text-foreground" />
            <span className="font-semibold text-xs text-foreground tracking-tight">
              墨匠
            </span>
          </Link>

          <Button
            variant="ghost"
            size="icon-xs"
            className="size-7 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setLeftCollapsed((prev) => !prev)}
            title={leftCollapsed ? "展开笔记列表" : "收起笔记列表"}
          >
            {leftCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>
      </header>

      {/* 得到大脑式三栏结构（左侧可收起） */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左栏：知识库笔记列表（宽度适度缩小，支持按钮收起） */}
        <aside
          className={`relative flex flex-col border-r bg-card transition-[width] duration-200 ease-in-out overflow-hidden ${
            leftCollapsed ? "w-0 border-r-0" : "w-64 shrink-0"
          }`}
        >
          <div className="border-b p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              {/* 知识库头部：图标 + 名称(点击编辑) + 下拉切换按钮 */}
              <div className="relative flex items-center gap-2 min-w-0 flex-1">
                <Folder className="size-5 text-primary shrink-0" />

                {/* 点击知识库名字：弹出编辑知识库对话框 */}
                <button
                  type="button"
                  onClick={() => setEditKbDialogOpen(true)}
                  className="font-bold text-base text-foreground truncate hover:text-primary transition-colors text-left"
                  title="点击修改知识库名称与描述"
                >
                  {kb?.name || "知识库"}
                </button>

                {/* 点击下拉箭头：展开带搜索的知识库切换面板 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setKbDropdownOpen((prev) => !prev);
                    setKbSearchQuery("");
                  }}
                  className={`size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all shrink-0 ${
                    kbDropdownOpen ? "bg-muted text-foreground" : ""
                  }`}
                  title="切换知识库"
                >
                  <ChevronDown
                    className={`size-4 transition-transform duration-150 ${kbDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* 知识库切换下拉浮层 (带搜索功能) */}
                {kbDropdownOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-0 top-full mt-1.5 z-40 w-56 overflow-hidden rounded-xl border bg-popover/98 p-1.5 shadow-2xl backdrop-blur-md ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100 text-xs space-y-1.5"
                  >
                    {/* 知识库搜索框 */}
                    <div className="relative px-1 pt-0.5">
                      <Search className="absolute top-1/2 left-3 size-3 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        aria-label="搜索知识库"
                        autoFocus
                        value={kbSearchQuery}
                        onChange={(e) => setKbSearchQuery(e.target.value)}
                        placeholder="搜索知识库..."
                        className="h-6 pl-6 text-[11px] rounded-md"
                      />
                    </div>

                    {/* 知识库列表 */}
                    <div className="max-h-48 overflow-y-auto space-y-0.5 px-0.5">
                      {allKbs
                        .filter((k) =>
                          (k.name || "")
                            .toLowerCase()
                            .includes(kbSearchQuery.toLowerCase()),
                        )
                        .map((k) => {
                          const isCurrent = k.id === kbId;
                          return (
                            <button
                              key={k.id}
                              onClick={() => {
                                setKbDropdownOpen(false);
                                handleSwitchKb(k.id);
                              }}
                              className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors ${
                                isCurrent
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-foreground hover:bg-muted"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <Folder className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{k.name}</span>
                              </div>
                              {isCurrent && (
                                <Check className="size-3 text-primary shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      {allKbs.filter((k) =>
                        (k.name || "")
                          .toLowerCase()
                          .includes(kbSearchQuery.toLowerCase()),
                      ).length === 0 && (
                        <div className="py-3 text-center text-[11px] text-muted-foreground">
                          未找到知识库
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-1 px-1">
                      <button
                        onClick={() => {
                          setKbDropdownOpen(false);
                          setNewKbOpen(true);
                        }}
                        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-primary hover:bg-primary/10 font-medium transition-colors"
                      >
                        <FolderPlus className="size-3.5" />
                        <span>新建知识库</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 添加按钮与弹出操作菜单 */}
              <div className="relative shrink-0">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={`size-8 rounded-md text-muted-foreground hover:text-foreground transition-all ${
                    addMenuOpen
                      ? "bg-muted text-foreground ring-1 ring-border"
                      : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddMenuOpen((prev) => !prev);
                  }}
                  title="新建与导入"
                >
                  <Plus className="size-4.5" />
                </Button>

                {/* 添加下拉菜单 */}
                {addMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1.5 z-40 w-44 overflow-hidden rounded-xl border bg-popover/95 p-1 shadow-2xl backdrop-blur-md ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100 text-xs"
                  >
                    <button
                      onClick={handleCreateBlankNote}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <FileText className="size-4 text-primary shrink-0" />
                      <span>写笔记</span>
                    </button>

                    <button
                      onClick={() => {
                        setAddMenuOpen(false);
                        setLinkOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Link2 className="size-4 text-blue-600 shrink-0" />
                      <span>粘贴链接</span>
                    </button>

                    <button
                      onClick={() => {
                        setAddMenuOpen(false);
                        setImportOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Upload className="size-4 text-purple-600 shrink-0" />
                      <span>添加文件</span>
                    </button>

                    <button
                      onClick={() => {
                        setAddMenuOpen(false);
                        mdFileInputRef.current?.click();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <FileCode className="size-4 text-emerald-600 shrink-0" />
                      <span>导入 Markdown</span>
                    </button>

                    <div className="my-1 h-px bg-border/60" />

                    <button
                      onClick={() => {
                        setAddMenuOpen(false);
                        setNewKbOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <FolderPlus className="size-4 text-amber-600 shrink-0" />
                      <span>新建文件夹 (知识库)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 工具栏：左侧笔记数量，右侧多选、排序、搜索图标 */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-[11px] text-muted-foreground">
                {notes.length} 篇笔记
              </span>

              <div className="flex items-center gap-0.5">
                {/* 多选模式开关 */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={`size-6 rounded-md transition-colors ${
                    isMultiSelectMode
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setIsMultiSelectMode((prev) => {
                      const next = !prev;
                      if (!next) setSelectedNoteIds(new Set());
                      return next;
                    });
                  }}
                  title={isMultiSelectMode ? "退出多选" : "多选模式"}
                >
                  <ListChecks className="size-3.5" />
                </Button>

                {/* 排序切换：最新 -> 最早 -> 标题 -> 最新 */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={`size-6 rounded-md transition-colors ${
                    sortOrder !== "newest"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setSortOrder((prev) => {
                      if (prev === "newest") return "oldest";
                      if (prev === "oldest") return "title";
                      return "newest";
                    });
                  }}
                  title={`当前排序：${
                    sortOrder === "newest"
                      ? "最新创建 (点击切换为最早)"
                      : sortOrder === "oldest"
                        ? "最早创建 (点击切换为按标题)"
                        : "按标题 (点击切换为最新)"
                  }`}
                >
                  <ArrowDownUp className="size-3.5" />
                </Button>

                {/* 搜索开关 */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={`size-6 rounded-md transition-colors ${
                    searchOpen || searchQuery
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setSearchOpen((prev) => {
                      const next = !prev;
                      if (!next) setSearchQuery("");
                      return next;
                    });
                  }}
                  title="搜索笔记"
                >
                  <Search className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* 点击搜索图标展开的搜索输入框 */}
            {searchOpen && (
              <div className="relative pt-1 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground mt-0.5" />
                <Input
                  aria-label="搜索笔记"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索笔记..."
                  className="h-7 pl-7 pr-7 text-xs rounded-md"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 笔记列表：仅展示图标、标题和时间，hover 展现三点操作 */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {filteredNotes.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                暂无笔记
              </div>
            ) : (
              filteredNotes.map((n) => (
                <NoteListItem
                  key={n.id}
                  note={n}
                  isSelected={selectedNote?.id === n.id}
                  isChecked={selectedNoteIds.has(n.id)}
                  isMultiSelectMode={isMultiSelectMode}
                  menuOpen={menuNoteId === n.id}
                  showRemoveFromKb={!kb?.isDefault}
                  onSelect={selectNoteItem}
                  onToggleSelect={toggleNoteSelect}
                  onToggleMenu={(noteId) =>
                    setMenuNoteId((prev) => (prev === noteId ? null : noteId))
                  }
                  onQuickDraft={handleQuickDraft}
                  onExportMarkdown={handleExportMarkdown}
                  onEdit={(note) => {
                    setMenuNoteId(null);
                    setNoteToEdit(note);
                    setEditDialogOpen(true);
                  }}
                  onMove={(note) => {
                    setMenuNoteId(null);
                    setMovingNoteIds([note.id]);
                    setMoveDialogOpen(true);
                  }}
                  onRemoveFromKb={handleRemoveFromKb}
                  onDelete={triggerDeleteSingle}
                />
              ))
            )}
          </div>

          {/* 侧边栏底部居中悬浮药丸操作栏 */}
          {selectedNoteIds.size > 0 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-full border bg-popover/95 px-2.5 py-1.5 shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 max-w-[calc(100%-16px)]">
              <span className="text-[11px] font-semibold text-foreground whitespace-nowrap px-1">
                已选{" "}
                <span className="font-bold text-primary">
                  {selectedNoteIds.size}
                </span>
              </span>

              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 gap-1 rounded-full text-[11px]"
                onClick={() => {
                  setMovingNoteIds(Array.from(selectedNoteIds));
                  setMoveDialogOpen(true);
                }}
                title="移动到知识库"
              >
                <FolderInput className="size-3" />
                <span>移动</span>
              </Button>

              <Button
                size="sm"
                variant="destructive"
                className="h-6 px-2 gap-1 rounded-full text-[11px] font-semibold"
                onClick={triggerBatchDelete}
                title="批量删除"
              >
                <Trash2 className="size-3" />
                <span>删除</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded-full"
                onClick={() => setSelectedNoteIds(new Set())}
              >
                取消
              </Button>
            </div>
          )}
        </aside>

        {/* 中间栏：笔记详情与 Markdown 编辑器 */}
        <main className="flex flex-1 flex-col bg-background overflow-y-auto no-scrollbar border-r min-w-0">
          {selectedNote ? (
            <div className="flex flex-col flex-1">
              {/* 笔记标题与标签区域（纯标签体系，支持行内删除、增加与智能标签推荐） */}
              <div className="w-full max-w-4xl mx-auto px-8 pt-8 pb-2 space-y-3.5">
                {/* 标题用自适应高度文本域：过长自动换行；回车视为确认而非换行 */}
                <Textarea
                  ref={titleRef}
                  aria-label="笔记标题"
                  rows={1}
                  value={editingTitle}
                  onChange={(e) =>
                    setEditingTitle(
                      e.target.value.replace(/\s*[\r\n]+\s*/g, " "),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="笔记标题..."
                  className="min-h-0 resize-none overflow-hidden border-0 rounded-md p-0 py-1 text-2xl sm:text-[28px] md:text-[28px] font-bold tracking-tight shadow-none focus-visible:ring-0 h-auto leading-snug text-foreground placeholder:text-muted-foreground/35"
                />

                {/* 标签栏 */}
                <div className="relative flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge
                    variant="outline"
                    className="gap-1 text-[11px] font-normal rounded-md"
                  >
                    <Tag className="size-2.5" />
                    {kb?.name}
                  </Badge>

                  {/* 笔记现有标签（无前缀#，hover时显现删除叉号） */}
                  {(selectedNote.tags || []).map((t) => (
                    <span
                      key={t}
                      className="group/tag inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-muted"
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hidden group-hover/tag:inline-flex items-center justify-center rounded hover:bg-background/80 hover:text-destructive p-0.5 text-muted-foreground/60 transition-colors ml-1 -mr-0.5"
                        title={`删除标签 ${t}`}
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}

                  {/* 添加标签下拉面板 */}
                  {isAddingTag && (
                    <div
                      className="absolute left-0 top-full mt-1.5 z-30 w-64 overflow-hidden rounded-xl border bg-popover shadow-2xl backdrop-blur-md ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="border-b p-2">
                        <input
                          autoFocus
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.stopPropagation();
                              setIsAddingTag(false);
                              setNewTagInput("");
                            } else if (e.key === "Enter" && currentTag) {
                              e.preventDefault();
                              void handleAddTag(currentTag);
                            }
                          }}
                          placeholder="搜索已有标签，或输入新标签回车创建..."
                          className="w-full rounded-md border bg-background px-2.5 py-1.5 text-[11px] outline-none focus:border-primary/50"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto p-1">
                        {currentTag &&
                          !knownTags.some((t) => t.name === currentTag) && (
                            <button
                              type="button"
                              onClick={() => void handleAddTag(currentTag)}
                              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-primary transition-colors hover:bg-muted"
                            >
                              <Plus className="size-3" />
                              创建「{currentTag}」
                            </button>
                          )}
                        {candidateTags.map((t) => (
                          <button
                            key={t.name}
                            type="button"
                            onClick={() => void handleAddTag(t.name)}
                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-foreground transition-colors hover:bg-muted"
                          >
                            <span className="truncate">{t.name}</span>
                            <span className="tabular-nums text-[10px] text-muted-foreground/60">
                              {t.count} 篇
                            </span>
                          </button>
                        ))}
                        {!currentTag && candidateTags.length === 0 && (
                          <div className="px-2 py-3 text-center text-[11px] text-muted-foreground/70">
                            暂无其他标签，输入即可创建
                          </div>
                        )}
                        {currentTag &&
                          candidateTags.length === 0 &&
                          knownTags.some((t) => t.name === currentTag) &&
                          noteTags.includes(currentTag) && (
                            <div className="px-2 py-3 text-center text-[11px] text-muted-foreground/70">
                              当前笔记已拥有该标签
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                  {isAddingTag ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground bg-muted rounded-md gap-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAddingTag(false);
                        setNewTagInput("");
                      }}
                    >
                      <span>收起</span>
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground rounded-md gap-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAddingTag(true);
                        setNewTagInput("");
                      }}
                    >
                      <Plus className="size-3" />
                      <span>添加标签</span>
                    </Button>
                  )}

                  {/* 智能标签按钮（与添加标签同款胶囊样式，紫色以区分 AI 功能） */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] rounded-md gap-0.5 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
                    onClick={handleGenerateSmartTags}
                    disabled={smartTagsLoading}
                  >
                    {smartTagsLoading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Plus className="size-3" />
                    )}
                    <span>智能标签</span>
                  </Button>

                  {/* 智能标签推荐浮层面板 */}
                  {smartTagsOpen && (
                    <div className="absolute left-0 top-full mt-2 z-30 w-80 rounded-xl border bg-popover p-3.5 shadow-2xl backdrop-blur-md ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 text-xs space-y-2.5">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-1.5 font-semibold text-primary text-xs">
                          <Sparkles className="size-3.5" />
                          <span>AI 智能推荐标签</span>
                        </div>
                        <button
                          onClick={() => setSmartTagsOpen(false)}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>

                      {smartTagsLoading ? (
                        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
                          <Loader2 className="size-4 animate-spin text-primary" />
                          <span className="text-[11px]">
                            正在深度分析文章核心主题...
                          </span>
                        </div>
                      ) : smartTags.length === 0 ? (
                        <div className="py-4 text-center text-[11px] text-muted-foreground">
                          未能提取到标签，可补充文章内容后重试。
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-[11px] text-muted-foreground">
                            点击标签一键添加至当前笔记：
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {smartTags.map((st) => {
                              const alreadyHas = (
                                selectedNote.tags || []
                              ).includes(st);
                              return (
                                <button
                                  key={st}
                                  onClick={() => handleAddTag(st)}
                                  disabled={alreadyHas}
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                                    alreadyHas
                                      ? "bg-muted text-muted-foreground opacity-60 cursor-default"
                                      : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 cursor-pointer"
                                  }`}
                                >
                                  {alreadyHas ? (
                                    <Check className="size-2.5" />
                                  ) : (
                                    <Plus className="size-2.5" />
                                  )}
                                  <span>#{st}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between border-t pt-2">
                            <span className="text-[10px] text-muted-foreground">
                              共推荐 {smartTags.length} 个标签
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px] text-primary hover:bg-primary/10 px-2 rounded-md"
                              onClick={handleAcceptAllSmartTags}
                            >
                              全部采纳
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 内容/智鉴切换（独立一行，位于标签下方） */}
                <div className="flex items-center gap-4 border-b text-sm">
                  <button
                    onClick={() => setActiveTab("content")}
                    className={`font-semibold pb-1.5 -mb-px border-b-2 transition-colors ${
                      activeTab === "content"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    笔记内容
                  </button>
                  <button
                    onClick={() => setActiveTab("sprout")}
                    className={`font-semibold pb-1.5 -mb-px border-b-2 transition-colors flex items-center gap-1 ${
                      activeTab === "sprout"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className="size-3" />
                    智鉴
                  </button>

                  {/* 生成 / 重新生成知识卡片 */}
                  <div className="ml-auto flex items-center gap-2 pb-1">
                    {cardResult && (
                      <span
                        className={`text-[11px] animate-in fade-in ${
                          cardResult.includes("失败")
                            ? "text-destructive"
                            : "text-emerald-600"
                        }`}
                      >
                        {cardResult}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateCard}
                      disabled={cardExtracting}
                      className="h-6 px-2 text-[11px] rounded-md gap-1 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary"
                    >
                      {cardExtracting ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <IdCard className="size-3" />
                      )}
                      <span>{cardExtracting ? "生成中..." : "生成卡片"}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* 笔记正文与智鉴区域 */}
              <div className="w-full max-w-4xl mx-auto flex-1 px-8 pt-3 pb-8">
                {activeTab === "content" ? (
                  <MarkdownEditor
                    content={editingContent}
                    onChange={(val) => setEditingContent(val)}
                    minHeight="560px"
                  />
                ) : (
                  <SproutPanel
                    sprout={sprout}
                    sproutLoading={sproutLoading}
                    reSprouting={reSprouting}
                    onReSprout={handleReSprout}
                    onSendToWorkshop={handleSendSproutToWorkshop}
                  />
                )}
              </div>

              <div className="border-t p-4 text-xs text-muted-foreground flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span>{wordCount} 字</span>
                  <span>·</span>
                  <span className="text-[11px]">
                    {savingNote ? (
                      <span className="text-primary flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" />
                        正在自动保存...
                      </span>
                    ) : savedSuccess ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <Check className="size-3" />
                        已自动保存
                      </span>
                    ) : (
                      "已实时同步"
                    )}
                  </span>
                </div>
                <span>
                  创建于{" "}
                  {new Date(selectedNote.createdAt).toLocaleString("zh-CN")}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center text-muted-foreground gap-2">
              <FileText className="size-8 text-muted-foreground/30" />
              <p className="text-xs">选择左侧笔记查看或编辑详情</p>
            </div>
          )}
        </main>

        {/* 右栏：当前笔记对应的原子知识卡片面板 */}
        <NoteCardsPanel
          note={selectedNote}
          cards={noteCards}
          loading={cardsLoading}
          extracting={cardExtracting}
          extractResult={cardResult}
          onExtractCards={handleGenerateCard}
        />
      </div>

      {/* 删除确认对话框 (替代原生 confirm/alert) */}
      <DeleteNotesDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}
        count={deleteConfirm.count}
        title={deleteConfirm.title}
        onConfirm={deleteConfirm.action}
      />

      {/* 编辑属性弹窗 */}
      {noteToEdit && (
        <EditNoteDialog
          note={noteToEdit}
          kbs={allKbs}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setNoteToEdit(null);
          }}
          onSaved={fetchKbAndNotes}
        />
      )}

      {/* 移动笔记弹窗 */}
      <MoveNotesDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        noteIds={movingNoteIds}
        kbs={allKbs}
        currentKbId={kbId}
        onMoved={() => {
          setSelectedNoteIds(new Set());
          fetchKbAndNotes();
        }}
      />

      {/* 新建知识库/文件夹弹窗 */}
      <NewKbDialog
        open={newKbOpen}
        onOpenChange={setNewKbOpen}
        onCreated={() => {
          setNewKbOpen(false);
          fetchKbAndNotes();
        }}
      />

      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onCreated={fetchKbAndNotes}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onCreated={fetchKbAndNotes}
      />

      {/* 编辑知识库弹窗 */}
      <EditKbDialog
        kb={kb}
        open={editKbDialogOpen}
        onOpenChange={setEditKbDialogOpen}
        onSaved={fetchKbAndNotes}
      />
    </div>
  );
}
