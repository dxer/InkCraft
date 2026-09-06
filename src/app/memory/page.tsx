"use client";

import { Brain, Clock, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NotesResponse } from "@/lib/types";

export default function MemoryPage() {
  const [data, setData] = useState<NotesResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Brain className="size-5 text-muted-foreground" />
          创作者记忆
          <span className="text-sm font-normal text-muted-foreground">Memory & Insights</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          回顾思考轨迹与高频认知模型，沉淀历史闪念，触发新的作品灵感。
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2 rounded-xl border border-dashed">
          <Brain className="size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">暂无沉淀记忆</p>
          <p className="text-xs text-muted-foreground/70">
            在首页持续记录思考，记忆库将自动提炼沉淀。
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 记忆总览卡片 */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-xl border bg-card shadow-xs">
              <CardHeader className="p-5 pb-3">
                <CardDescription className="text-xs text-muted-foreground">已沉淀思考原料</CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                  {notes.length} <span className="text-xs font-normal text-muted-foreground">篇</span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="rounded-xl border bg-card shadow-xs">
              <CardHeader className="p-5 pb-3">
                <CardDescription className="text-xs text-muted-foreground">累计记录总字数</CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                  {notes.reduce((acc, n) => acc + n.wordCount, 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">字</span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="rounded-xl border bg-card shadow-xs">
              <CardHeader className="p-5 pb-3">
                <CardDescription className="text-xs text-muted-foreground">所属知识库</CardDescription>
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                  {data?.kbs.length || 1} <span className="text-xs font-normal text-muted-foreground">个</span>
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* 历史闪念时光流 */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span>灵感与思考精选记忆：</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {notes.slice(0, 8).map((note) => (
                <div key={note.id} className="rounded-xl border bg-card p-4 space-y-2 text-xs shadow-xs transition-all hover:border-foreground/30">
                  {note.title && <div className="font-semibold text-sm text-foreground">{note.title}</div>}
                  <p className="line-clamp-3 text-foreground/85 leading-relaxed font-sans whitespace-pre-wrap">
                    {note.content}
                  </p>
                  <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground border-t border-muted/50">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal rounded-md">
                      {note.category}
                    </Badge>
                    <span className="flex items-center gap-1 text-muted-foreground/75">
                      <Clock className="size-3 text-muted-foreground/50" />
                      {new Date(note.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
