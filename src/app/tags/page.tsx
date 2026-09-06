"use client";

import { Hash, Loader2, Search, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { NotesResponse } from "@/lib/types";

export default function TagsPage() {
  const [data, setData] = useState<NotesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/notes")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const notes = data?.notes || [];

  // 聚合所有标签与计数
  const tagCounts = new Map<string, number>();
  for (const n of notes) {
    for (const t of n.tags) {
      const clean = t.replace(/^#/, "").trim();
      if (clean) {
        tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
      }
    }
  }

  const allTags = Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const filteredTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const matchingNotes = selectedTag
    ? notes.filter((n) =>
        n.tags.map((t) => t.replace(/^#/, "")).includes(selectedTag),
      )
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Tag className="size-5 text-muted-foreground" />
          标签
          <span className="text-sm font-normal text-muted-foreground">
            Tags & Topics
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          全库智能与手动标签聚合视图，按主题标签聚合检索碎片与文献。
        </p>
      </header>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="搜索标签"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标签..."
            className="pl-9 text-xs rounded-md"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : allTags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2 rounded-xl border border-dashed">
          <Tag className="size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">暂无标签数据</p>
          <p className="text-xs text-muted-foreground/70">
            在首页录入笔记时 AI 会自动打上标签，或手动添加 #标签。
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 标签云 */}
          <div className="flex flex-wrap gap-2">
            {filteredTags.map((tag) => {
              const isSelected = selectedTag === tag.name;
              return (
                <button
                  key={tag.name}
                  onClick={() => setSelectedTag(isSelected ? null : tag.name)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.98] ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "bg-card hover:border-foreground/30 text-foreground"
                  }`}
                >
                  <Hash className="size-3 opacity-60" />
                  <span>{tag.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tag.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 选中标签下的笔记列表 */}
          {selectedTag && (
            <div className="space-y-3 border-t pt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  标签 #{selectedTag} 下的笔记（{matchingNotes.length} 篇）：
                </span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="text-xs text-primary hover:underline"
                >
                  清除选择
                </button>
              </div>

              <div className="space-y-2.5">
                {matchingNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border bg-card p-4 space-y-1.5 text-xs shadow-xs transition-all hover:border-foreground/30"
                  >
                    {note.title && (
                      <div className="font-semibold text-sm text-foreground">
                        {note.title}
                      </div>
                    )}
                    <p className="line-clamp-2 text-foreground/85 leading-relaxed font-sans">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 font-normal rounded-md"
                      >
                        {note.category}
                      </Badge>
                      <span className="tabular-nums">{note.wordCount} 字</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
