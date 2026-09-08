"use client";

import {
  BookOpen,
  Calendar,
  Edit3,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteKbDialog } from "./delete-kb-dialog";
import { EditKbDialog } from "./edit-kb-dialog";
import { NewKbDialog } from "./new-kb-dialog";
import type { KnowledgeBase } from "@/lib/types";

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.split(" ")[0] || dateStr;
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function KnowledgePage() {
  const router = useRouter();
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKbOpen, setNewKbOpen] = useState(false);

  // 编辑知识库
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);

  // 删除知识库确认弹窗
  const [deletingKb, setDeletingKb] = useState<KnowledgeBase | null>(null);

  // 打开的三个点菜单对应 kb.id
  const [menuKbId, setMenuKbId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/kbs")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.kbs) {
          setKbs(data.kbs);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // 点击外部关闭弹出的三个点菜单
  useEffect(() => {
    function handleClickOutside() {
      setMenuKbId(null);
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  async function fetchKbs() {
    try {
      const res = await fetch("/api/kbs");
      if (res.ok) {
        const data = await res.json();
        setKbs(data.kbs);
      }
    } finally {
      setLoading(false);
    }
  }

  function openKb(id: string) {
    router.push(`/knowledge/${id}`);
  }

  function handleMenuClick(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuKbId((prev) => (prev === id ? null : id));
  }

  function handleEditClick(kb: KnowledgeBase, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuKbId(null);
    setEditingKb(kb);
  }

  function handleDeleteClick(kb: KnowledgeBase, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuKbId(null);
    setDeletingKb(kb);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <BookOpen className="size-5 text-muted-foreground" />
            知识库
            <span className="text-sm font-normal text-muted-foreground">The Archives</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理专属知识库，按主题隔离沉淀原料，点击卡片进入独立工作台。
          </p>
        </div>

        <Button
          onClick={() => setNewKbOpen(true)}
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold rounded-md shadow-xs"
        >
          <FolderPlus className="size-3.5" />
          新建知识库
        </Button>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 新建知识库卡片（排在第一位） */}
          <button
            onClick={() => setNewKbOpen(true)}
            className="flex min-h-[160px] flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed p-5 text-center text-muted-foreground transition-all hover:border-foreground/40 hover:bg-muted/20 hover:text-foreground cursor-pointer"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Plus className="size-4.5" />
            </div>
            <div>
              <div className="text-sm font-semibold">新建知识库</div>
              <div className="text-[11px] text-muted-foreground">创建新的专题领域原料库</div>
            </div>
          </button>

          {/* 知识库卡片列表 */}
          {kbs.map((kb) => (
            <Card
              key={kb.id}
              onClick={() => openKb(kb.id)}
              className="group relative flex cursor-pointer flex-col justify-between rounded-xl border bg-card p-5 transition-all hover:border-foreground/30 hover:shadow-md"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Folder className="size-4.5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {kb.isDefault && (
                      <Badge variant="secondary" className="text-[10px] rounded-md">
                        默认库
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
                    {kb.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {kb.description || "点击进入浏览与编辑内部笔记"}
                  </p>
                </div>
              </div>

              {/* 底部操作区：左侧笔记数与创建日期，右侧三个点操作菜单 */}
              <div className="mt-5 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="tabular-nums font-medium text-foreground">
                    {kb.notesCount} 篇笔记
                  </span>
                  {kb.createdAt && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/75">
                      <Calendar className="size-3 text-muted-foreground/60" />
                      <span>{formatDate(kb.createdAt)}</span>
                    </span>
                  )}
                </div>

                {/* 右下角三个点菜单按钮与弹出层 */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className={`size-6 rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground ${
                      menuKbId === kb.id ? "bg-muted text-foreground ring-1 ring-border" : ""
                    }`}
                    onClick={(e) => handleMenuClick(kb.id, e)}
                    title="更多操作"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>

                  {/* 弹出菜单 */}
                  {menuKbId === kb.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 bottom-full mb-1.5 z-30 w-36 overflow-hidden rounded-xl border bg-popover/95 p-1 shadow-xl backdrop-blur-md ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100 text-xs"
                    >
                      <button
                        onClick={(e) => handleEditClick(kb, e)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <Edit3 className="size-3.5 text-muted-foreground" />
                        <span>编辑信息</span>
                      </button>

                      {!kb.isDefault && (
                        <>
                          <div className="my-0.5 h-px bg-border/60" />
                          <button
                            onClick={(e) => handleDeleteClick(kb, e)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3.5" />
                            <span>删除知识库</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 编辑知识库弹窗 */}
      <EditKbDialog
        kb={editingKb}
        open={!!editingKb}
        onOpenChange={(open) => !open && setEditingKb(null)}
        onSaved={fetchKbs}
      />

      {/* 删除知识库确认弹窗 */}
      <DeleteKbDialog
        kb={deletingKb}
        open={!!deletingKb}
        onOpenChange={(open) => !open && setDeletingKb(null)}
        onDeleted={fetchKbs}
      />

      {/* 新建知识库弹窗 */}
      <NewKbDialog
        open={newKbOpen}
        onOpenChange={setNewKbOpen}
        onCreated={() => {
          setNewKbOpen(false);
          fetchKbs();
        }}
      />
    </div>
  );
}
