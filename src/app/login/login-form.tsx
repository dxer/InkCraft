"use client";

import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Cpu,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Layers,
  Loader2,
  LogOut,
  Radio,
  Share2,
  Sparkles,
  Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InkCraftMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * 动态流体墨滴交互画布 (Living Ink Canvas)
 * 具有更明显的高级微光粒子、弹性网格互联和光标排斥力场
 */
function InkFlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const PARTICLE_COUNT = Math.min(Math.floor((width * height) / 22000), 55);
    const MAX_DIST = 160;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseAlpha: number;
      phase: number;
    }

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      radius: Math.random() * 2.2 + 1.2,
      baseAlpha: Math.random() * 0.45 + 0.35,
      phase: Math.random() * Math.PI * 2,
    }));

    const mouse = { x: -9999, y: -9999, active: false };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const onMouseLeave = () => {
      mouse.active = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    let time = 0;
    const render = () => {
      time += 0.02;
      const isDark = document.documentElement.classList.contains("dark");
      ctx.clearRect(0, 0, width, height);

      const pRgb = isDark ? "255, 255, 255" : "20, 25, 35";
      const lRgb = isDark ? "220, 235, 255" : "30, 45, 65";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150 && dist > 0) {
            const force = (150 - dist) / 150;
            p.x += (dx / dist) * force * 1.6;
            p.y += (dy / dist) * force * 1.6;
          }
        }

        const currentAlpha =
          p.baseAlpha * (0.8 + 0.2 * Math.sin(time + p.phase));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pRgb}, ${currentAlpha * (isDark ? 0.6 : 0.35)})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MAX_DIST) {
            const factor = 1 - dist / MAX_DIST;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${lRgb}, ${factor * (isDark ? 0.16 : 0.08)})`;
            ctx.lineWidth = factor * 1.4;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 opacity-90 transition-opacity duration-1000"
    />
  );
}

/**
 * 动态天体罗盘刻度轮 (Concentric Rotating Blueprint Rings)
 * 赋予背景极强的高精工业与工坊机械感，随时间缓缓自旋
 */
function BlueprintRings() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 select-none opacity-40 dark:opacity-30"
    >
      {/* 外圈自旋罗盘 (顺时针，超慢自旋) */}
      <div className="size-[640px] sm:size-[780px] lg:size-[920px] rounded-full border border-dashed border-foreground/20 animate-[spin_120s_linear_infinite]" />

      {/* 中圈逆向同心环 */}
      <div className="absolute inset-8 sm:inset-14 lg:inset-20 rounded-full border border-foreground/15 border-t-foreground/40 animate-[spin_80s_linear_infinite_reverse]" />

      {/* 内圈微光雷达环 */}
      <div className="absolute inset-24 sm:inset-36 lg:inset-44 rounded-full border border-foreground/10 animate-[pulse_6s_ease-in-out_infinite]" />
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        setError(data?.error || "门禁密码错误");
      }
    } catch {
      setError("网络连接异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col justify-between overflow-hidden bg-background text-foreground antialiased select-none p-4 sm:p-6 md:p-8">
      {/* 1. 动态物理流体画布 */}
      <InkFlowCanvas />

      {/* 2. 背景精密同心罗盘轮环 */}
      <BlueprintRings />

      {/* 3. 环境大氛围：双色温游弋极光墨晕 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden z-0"
      >
        {/* 背景微粒坐标阵列 */}
        <div className="absolute inset-0 bg-[radial-gradient(oklch(from_var(--foreground)_l_c_h_/_0.09)_1px,transparent_1px)] [background-size:28px_28px] opacity-70" />

        {/* 顶部中央辉光 (在暗色下泛出沉静的青墨冷光，在亮色下泛出温润纸光) */}
        <div className="animate-ink-pulse-glow absolute -top-40 left-1/2 h-[48rem] w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-b from-foreground/[0.1] via-foreground/[0.03] to-transparent blur-[110px]" />

        {/* 左上与右下游弋深墨云团 */}
        <div className="animate-ink-float-1 absolute -left-28 top-1/4 h-[36rem] w-[36rem] rounded-full bg-foreground/[0.05] blur-[140px]" />
        <div className="animate-ink-float-2 absolute -bottom-28 -right-28 h-[40rem] w-[40rem] rounded-full bg-foreground/[0.04] blur-[150px]" />
      </div>

      {/* 4. 顶部极简信息悬浮栏 */}
      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-full border border-border/60 bg-background/80 px-3.5 py-1.5 backdrop-blur-xl shadow-xs">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold tracking-tight">墨匠</span>
            <span className="text-[10px] text-muted-foreground/80 font-mono tracking-widest uppercase">
              InkCraft
            </span>
          </div>
          <span className="hidden sm:inline-flex text-[11px] text-muted-foreground/75 tracking-wider font-medium">
            本地优先 AI 内容装配工坊
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 p-1 backdrop-blur-xl shadow-xs">
          <ThemeToggle className="size-7 rounded-full cursor-pointer hover:bg-muted/80" />
        </div>
      </header>

      {/* 5. 核心舞台：在桌面端展开双翼卡片，在紧凑视窗/内嵌浏览器中平滑聚焦 */}
      <main className="relative z-10 my-auto flex w-full max-w-7xl flex-col items-center justify-center py-6 lg:py-10">
        <div className="grid w-full grid-cols-1 items-center justify-items-center gap-8 lg:grid-cols-[1fr_420px_1fr] xl:gap-14">
          {/* 左翼：实时选题雷达 & 流水线 (宽屏展开) */}
          <div className="hidden w-full max-w-[320px] flex-col gap-5 lg:flex">
            {/* 灵感雷达卡片 */}
            <div className="animate-float-card-1 group relative rounded-2xl border border-border/60 bg-card/75 p-5 backdrop-blur-2xl shadow-xs transition-all duration-500 hover:border-foreground/30 hover:bg-card/90">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-foreground/[0.07] text-foreground">
                    <Radio className="size-3.5 animate-pulse text-primary" />
                  </div>
                  <span className="text-xs font-semibold tracking-tight">
                    选题雷达
                  </span>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="size-1 rounded-full bg-emerald-500 animate-ping" />
                  增量扫描就绪
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground font-medium line-clamp-2">
                《认知差即红利：为什么高产创作者都在构建个人知识装配库？》
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                <span className="rounded-md bg-muted/70 px-1.5 py-0.5 font-mono font-medium">
                  潜力分: 94
                </span>
                <span className="rounded-md bg-muted/70 px-1.5 py-0.5">
                  公众号专栏
                </span>
              </div>
            </div>

            {/* 四步装配流水线卡片 */}
            <div className="animate-float-card-2 group relative overflow-hidden rounded-2xl border border-border/60 bg-card/75 p-5 backdrop-blur-2xl shadow-xs transition-all duration-500 hover:border-foreground/30 hover:bg-card/90">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-foreground/[0.07] text-foreground">
                    <Layers className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold tracking-tight">
                    四步内容流水线
                  </span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground/80 font-medium">
                  STAGE 03/04
                </span>
              </div>

              {/* 步骤条指示器 */}
              <div className="mt-4 grid grid-cols-4 gap-1 text-center font-mono text-[9px] text-muted-foreground">
                <div className="rounded bg-foreground/15 py-1 text-foreground font-medium">
                  01 选题
                </div>
                <div className="rounded bg-foreground/15 py-1 text-foreground font-medium">
                  02 素材
                </div>
                <div className="rounded bg-primary text-primary-foreground py-1 font-semibold shadow-xs">
                  03 初稿
                </div>
                <div className="rounded bg-muted/60 py-1">
                  04 审校
                </div>
              </div>

              {/* 进度光束扫描动画条 */}
              <div className="relative mt-3 h-1 w-full overflow-hidden rounded-full bg-muted/70">
                <div className="animate-beam-scan absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
              </div>
            </div>
          </div>

          {/* 居中：核心门禁双层卡片 (Doppelrand Core Card) */}
          <div className="animate-ink-rise w-full max-w-[410px]">
            {/* 外层铝框外壳 Bezel */}
            <div className="rounded-[2.25rem] border border-foreground/[0.1] bg-gradient-to-b from-foreground/[0.08] via-foreground/[0.02] to-foreground/[0.06] p-2 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-2xl dark:border-white/[0.14] dark:from-white/[0.14] dark:via-white/[0.02] dark:to-white/[0.08] dark:shadow-[0_35px_90px_-25px_rgba(0,0,0,0.7)]">
              {/* 内层玻璃核 Core */}
              <div className="relative flex flex-col items-center overflow-hidden rounded-[calc(2.25rem-0.5rem)] border border-border/60 bg-card/92 px-7 py-8 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.95)] backdrop-blur-2xl dark:bg-card/85 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] sm:px-9 sm:py-9">
                {/* 顶部环境装饰微光 */}
                <div className="pointer-events-none absolute -top-12 left-1/2 size-40 -translate-x-1/2 rounded-full bg-foreground/[0.08] blur-2xl dark:bg-white/[0.1]" />

                {/* 印章式立体徽标 */}
                <div className="animate-ink-seal relative mb-5 flex size-[4.75rem] items-center justify-center rounded-full border border-foreground/15 bg-foreground/[0.03] p-1.5 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.1)] transition-transform duration-500 hover:scale-105">
                  <div className="flex size-full items-center justify-center rounded-full border border-foreground/20 bg-background shadow-xs">
                    <InkCraftMark className="size-8 text-foreground" />
                  </div>
                </div>

                {/* 模式微胶囊标签 */}
                <div className="inline-flex items-center gap-1.5 rounded-full border border-foreground/[0.1] bg-foreground/[0.04] px-3 py-0.5 text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                  <Sparkles className="size-2.5 opacity-80" />
                  <span>
                    {firstRun ? "FIRST-RUN SETUP" : "SECURITY GATE"}
                  </span>
                </div>

                {/* 标题与导语 */}
                <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {firstRun ? "为工坊设定专属访问口令" : "解锁你的创作工坊"}
                </h1>
                <p className="mt-1.5 max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                  {firstRun
                    ? "首次运行墨匠。口令将持久保存在本地数据库，保护你的全部知识与成稿。"
                    : "输入访问口令，进入流水线装配台。"}
                </p>

                {/* 交互输入表单 */}
                <form onSubmit={handleLogin} className="mt-6 w-full space-y-4">
                  <div className="relative space-y-2">
                    <div className="relative flex items-center">
                      <KeyRound className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground/75" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        aria-label={firstRun ? "新访问口令" : "访问口令"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          firstRun
                            ? "设置至少 4 位访问口令..."
                            : "输入访问口令..."
                        }
                        className="h-11 w-full rounded-xl border-border/80 bg-muted/40 pl-10 pr-10 font-mono text-xs tracking-wider transition-all duration-200 placeholder:text-muted-foreground/50 focus-visible:border-foreground/50 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-foreground/15"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-muted-foreground/60 transition-colors hover:text-foreground cursor-pointer"
                        tabIndex={-1}
                        aria-label={showPassword ? "隐藏口令" : "显示口令"}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>

                    {/* 错误反馈微抖动提示 */}
                    {error && (
                      <div className="animate-shake flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 py-2 text-center text-xs text-destructive font-medium">
                        <span>{error}</span>
                      </div>
                    )}
                  </div>

                  {/* 岛屿提交按钮 (Button-in-Button) */}
                  <Button
                    type="submit"
                    disabled={!password.trim() || submitting}
                    className="group relative h-11 w-full rounded-xl bg-foreground pl-5 pr-2 text-xs font-medium text-background shadow-md transition-all duration-300 hover:bg-foreground/90 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    <span className="tracking-wide">
                      {submitting
                        ? "正在建立安全会话..."
                        : firstRun
                          ? "保存口令并开启工坊"
                          : "验证口令并进入"}
                    </span>
                    <div className="flex size-7 items-center justify-center rounded-lg bg-background/20 text-background transition-transform duration-300 group-hover:translate-x-0.5 group-active:scale-90">
                      {submitting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="size-3.5" />
                      )}
                    </div>
                  </Button>
                </form>

                {/* 已认证状态退出通道 */}
                {authed && (
                  <button
                    type="button"
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
                    className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground/80 transition-colors hover:text-foreground cursor-pointer"
                  >
                    {loggingOut ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <LogOut className="size-3" />
                    )}
                    <span>退出当前已认证会话</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 右翼：八项知识卡片萃取 & 多端排版引擎 (宽屏展开) */}
          <div className="hidden w-full max-w-[320px] flex-col gap-5 lg:flex">
            {/* 八项知识卡片萃取 */}
            <div className="animate-float-card-2 group relative rounded-2xl border border-border/60 bg-card/75 p-5 backdrop-blur-2xl shadow-xs transition-all duration-500 hover:border-foreground/30 hover:bg-card/90">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-foreground/[0.07] text-foreground">
                    <FileText className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold tracking-tight">
                    八项知识卡片
                  </span>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary font-medium">
                  结构化萃取
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground font-medium">
                “写作本质不是苦思冥想，而是高质量卡片材料的定向调用与结构编织。”
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                <span className="rounded-md bg-muted/70 px-1.5 py-0.5">
                  #反常识洞见
                </span>
                <span className="rounded-md bg-muted/70 px-1.5 py-0.5">
                  #金句库
                </span>
              </div>
            </div>

            {/* 多渠道排版分发引擎 */}
            <div className="animate-float-card-1 group relative rounded-2xl border border-border/60 bg-card/75 p-5 backdrop-blur-2xl shadow-xs transition-all duration-500 hover:border-foreground/30 hover:bg-card/90">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-foreground/[0.07] text-foreground">
                    <Share2 className="size-3.5" />
                  </div>
                  <span className="text-xs font-semibold tracking-tight">
                    排版转译引擎
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="size-3" />
                  <span>多端样式就绪</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px] font-medium text-muted-foreground">
                <div className="rounded-lg border border-border/50 bg-muted/40 py-1.5">
                  微信公众号
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/40 py-1.5">
                  小红书卡片
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/40 py-1.5">
                  知乎专栏
                </div>
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground/70 flex items-center justify-between">
                <span>标准 Markdown 内联渲染</span>
                <span className="font-mono">SQLite WAL</span>
              </p>
            </div>
          </div>
        </div>

        {/* 6. 中小屏幕/内嵌浏览器自适应：工坊能力流动胶囊栏 (在宽屏侧翼折叠时展示，彻底填补留白！) */}
        <div className="mt-6 flex lg:hidden w-full max-w-[410px] flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur-md shadow-2xs">
            <Radio className="size-3 text-emerald-500 animate-pulse" />
            <span>选题雷达就绪</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur-md shadow-2xs">
            <Layers className="size-3 text-primary" />
            <span>四步内容流水线</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur-md shadow-2xs">
            <FileText className="size-3 text-primary" />
            <span>八项知识卡片</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur-md shadow-2xs">
            <Share2 className="size-3 text-primary" />
            <span>一键多渠道转译</span>
          </div>
        </div>
      </main>

      {/* 7. 底部工坊印章脚注 */}
      <footer className="relative z-20 flex items-center justify-center py-2 text-center">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 tracking-wider">
          <Compass className="size-3.5 opacity-70" />
          <span>墨匠 · 本地优先的现代 AI 内容创作工坊</span>
        </div>
      </footer>
    </div>
  );
}
