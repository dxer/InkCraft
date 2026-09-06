"use client";

import { FileText, Library, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PlatformBadge, StageBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface WorkItem {
  id: string;
  title: string;
  currentStage: string;
  wordCount: number;
  updatedAt: string;
  variants: string[];
}

export default function WorksPage() {
  const router = useRouter();
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "drafted" | "distributed"
  >("all");

  const fetchWorks = useCallback(async () => {
    try {
      const res = await fetch("/api/works");
      if (res.ok) {
        const data = await res.json();
        setWorks(data.works);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorks();
  }, [fetchWorks]);

  async function createNewAndOpen() {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `装配新成果 · ${new Date().toLocaleDateString("zh-CN")}`,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.project?.id) {
        router.push(`/workshop?projectId=${data.project.id}`);
      }
    }
  }

  const statusCounts = {
    all: works.length,
    drafted: works.filter((w) => w.wordCount > 0).length,
    distributed: works.filter((w) => w.variants.length > 0).length,
  };

  const filtered = works
    .filter((w) =>
      w.title.toLowerCase().includes(search.toLowerCase()),
    )
    .filter((w) => {
      if (statusFilter === "drafted") return w.wordCount > 0;
      if (statusFilter === "distributed") return w.variants.length > 0;
      return true;
    });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Library className="size-5 text-muted-foreground" />
            成品库
            <span className="text-sm font-normal text-muted-foreground">
              The Shelf
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            母稿画廊与一鱼多吃分发矩阵，点击直接进入成稿内容页面阅读与复制。
          </p>
        </div>
        <Button
          onClick={createNewAndOpen}
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold rounded-md shadow-xs"
        >
          <Plus className="size-3.5" />
          装配新作品
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="搜索作品标题"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索作品标题..."
            className="pl-9 text-xs rounded-md"
          />
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="按状态筛选">
          {(
            [
              { key: "all", label: "全部" },
              { key: "drafted", label: "已成稿" },
              { key: "distributed", label: "已分发" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              aria-pressed={statusFilter === key}
              className={`rounded-full border px-3 py-1 text-xs tabular-nums transition-colors ${
                statusFilter === key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              }`}
            >
              {label} ({statusCounts[key]})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl border bg-muted/40"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-dashed py-14 text-center">
            <Library className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium">成品库暂无作品</p>
            <p className="mt-1 text-xs text-muted-foreground">
              在工坊完成初稿并转译后，母稿与多平台版本将自动呈现在这里。
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((work) => (
            <Link
              key={work.id}
              href={`/works/${work.id}`}
              className="group block focus:outline-none"
            >
              <Card className="h-full flex flex-col justify-between rounded-xl border bg-card transition-all hover:border-foreground/40 hover:shadow-md cursor-pointer">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <FileText className="size-3.5 text-muted-foreground" />
                      {work.wordCount > 0 ? `${work.wordCount} 字` : "草稿中"}
                      <StageBadge stage={work.currentStage} />
                    </span>
                    <span>{formatDate(work.updatedAt)}</span>
                  </div>
                  <CardTitle className="mt-2 text-base font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {work.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5 pt-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {work.variants.length > 0 ? (
                      work.variants.map((v) => (
                        <PlatformBadge
                          key={v}
                          platform={v}
                          label={`${v} 已派生`}
                        />
                      ))
                    ) : (
                      <span className="rounded border border-dashed px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        未派生
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.split(" ")[0] || dateStr;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return dateStr;
  }
}
