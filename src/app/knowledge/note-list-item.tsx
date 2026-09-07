"use client";

import {
  Check,
  Download,
  Edit3,
  FileText,
  FolderInput,
  FolderMinus,
  MoreHorizontal,
  Trash2,
  Zap,
} from "lucide-react";
import type { MouseEvent } from "react";
import type { NoteItem } from "@/lib/types";
import { formatCompactTime } from "@/lib/utils";

interface NoteListItemProps {
  note: NoteItem;
  isSelected: boolean;
  isChecked: boolean;
  isMultiSelectMode: boolean;
  /** 该条目的三点操作菜单是否展开（由父组件持有 menuNoteId 状态） */
  menuOpen: boolean;
  /** 非默认知识库才显示「移出知识库」 */
  showRemoveFromKb: boolean;
  onSelect: (note: NoteItem) => void;
  onToggleSelect: (noteId: string) => void;
  onToggleMenu: (noteId: string) => void;
  onQuickDraft: (note: NoteItem, e: MouseEvent<Element>) => void;
  onExportMarkdown: (note: NoteItem, e: MouseEvent<Element>) => void;
  onEdit: (note: NoteItem) => void;
  onMove: (note: NoteItem) => void;
  onRemoveFromKb: (noteId: string, e: MouseEvent<Element>) => void;
  onDelete: (note: NoteItem, e: MouseEvent<Element>) => void;
}

/**
 * 知识库左栏的单条笔记列表项（含多选勾选框与悬停三点操作菜单）。
 * 纯展示组件：状态与副作用全部由父组件持有，这里只做渲染与事件转发。
 */
export function NoteListItem({
  note,
  isSelected,
  isChecked,
  isMultiSelectMode,
  menuOpen,
  showRemoveFromKb,
  onSelect,
  onToggleSelect,
  onToggleMenu,
  onQuickDraft,
  onExportMarkdown,
  onEdit,
  onMove,
  onRemoveFromKb,
  onDelete,
}: NoteListItemProps) {
  return (
    <div
      onClick={() => {
        if (isMultiSelectMode) {
          onToggleSelect(note.id);
        } else {
          onSelect(note);
        }
      }}
      className={`group relative flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left cursor-pointer transition-all ${
        isSelected
          ? "bg-primary/10 text-primary font-medium shadow-2xs border border-primary/20"
          : "hover:bg-muted/60 text-foreground"
      }`}
    >
      {/* 左侧图标与文本内容 */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FileText className="size-3.5 shrink-0 text-muted-foreground/80" />

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground leading-tight">
            {note.title || "未命名笔记"}
          </div>
          <div className="text-[11px] text-muted-foreground/75 leading-none mt-0.5">
            {formatCompactTime(note.createdAt)}
          </div>
        </div>
      </div>

      {/* 右侧：多选模式下显示复选框；普通模式下显示三点菜单 */}
      {isMultiSelectMode ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(note.id);
          }}
          className={`size-4 rounded border flex items-center justify-center transition-all shrink-0 ${
            isChecked
              ? "bg-primary border-primary text-primary-foreground"
              : "border-muted-foreground/40 bg-background hover:border-primary"
          }`}
        >
          {isChecked && <Check className="size-3" />}
        </div>
      ) : (
        <div className="relative shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(note.id);
            }}
            className={`size-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-all ${
              menuOpen
                ? "opacity-100 bg-muted text-foreground"
                : "opacity-0 group-hover:opacity-100"
            }`}
            title="更多操作"
          >
            <MoreHorizontal className="size-3.5" />
          </button>

          {/* 弹出菜单 */}
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 z-30 w-36 overflow-hidden rounded-lg border bg-popover/95 p-1 shadow-xl backdrop-blur-md ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100 text-xs"
            >
              <button
                onClick={(e) => onQuickDraft(note, e)}
                title="以该素材为骨架直接进入起草工位，跳过选题与匹配"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Zap className="size-3.5 text-primary" />
                <span>直接成稿</span>
              </button>

              <div className="my-0.5 h-px bg-border/60" />

              <button
                onClick={(e) => onExportMarkdown(note, e)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
              >
                <Download className="size-3.5 text-muted-foreground" />
                <span>导出 Markdown</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(note);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
              >
                <Edit3 className="size-3.5 text-muted-foreground" />
                <span>编辑属性</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(note);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
              >
                <FolderInput className="size-3.5 text-muted-foreground" />
                <span>移动到...</span>
              </button>

              {showRemoveFromKb && (
                <button
                  onClick={(e) => onRemoveFromKb(note.id, e)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  <FolderMinus className="size-3.5 text-muted-foreground" />
                  <span>移出知识库</span>
                </button>
              )}

              <div className="my-0.5 h-px bg-border/60" />

              <button
                onClick={(e) => onDelete(note, e)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
                <span>删除笔记</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
