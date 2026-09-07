"use client";

import { Loader2, LogOut } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InkCraftMark } from "@/components/logo";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          加载中...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [firstRun, setFirstRun] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setAuthed(!!data?.authenticated);
        setFirstRun(data?.configured === false);
      })
      .catch(() => {});
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (res.ok) {
        router.push(from);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || "密码错误");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-4">
          <InkCraftMark className="mx-auto mb-3 size-11 text-foreground" />
          <CardTitle className="text-lg font-semibold">
            墨匠 · {firstRun ? "首次设置" : "门禁验证"}
          </CardTitle>
          <CardDescription className="text-xs">
            {firstRun
              ? "首次进入工坊，请设置访问口令以保护你的内容"
              : "请输入本自部署工坊的访问口令"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                aria-label={firstRun ? "新访问口令" : "访问口令"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  firstRun ? "设置至少 4 位的访问口令..." : "输入访问口令..."
                }
                className="text-center font-mono text-sm"
                autoFocus
              />
              {error && (
                <p className="text-xs text-destructive text-center">{error}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full text-xs font-semibold"
              disabled={!password.trim() || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                  处理中...
                </>
              ) : firstRun ? (
                "设置口令并进入"
              ) : (
                "进入内容工坊"
              )}
            </Button>
          </form>
          {authed && (
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full text-xs"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                  setAuthed(false);
                  setPassword("");
                  router.refresh();
                } finally {
                  setLoggingOut(false);
                }
              }}
            >
              {loggingOut ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <LogOut className="size-3.5 mr-1" />
              )}
              退出当前会话
            </Button>
          )}
          <div className="mt-6 text-center text-[11px] text-muted-foreground">
            本地优先 · 单文件数据持久化 · BYOK
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
