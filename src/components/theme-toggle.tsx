"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "inkcraft_theme";
const CHANGE_EVENT = "inkcraft-theme-change";
const ORDER: ThemeMode[] = ["light", "dark", "system"];

const META: Record<ThemeMode, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: "亮色主题（点击切换暗色）" },
  dark: { icon: Moon, label: "暗色主题（点击切换为跟随系统）" },
  system: { icon: Monitor, label: "跟随系统（点击切换亮色）" },
};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot(): ThemeMode {
  return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "system";
}

function getServerSnapshot(): ThemeMode {
  return "system";
}

/**
 * 三态主题切换：亮色 → 暗色 → 跟随系统，循环切换。
 * 首帧由 layout 中的阻塞脚本按 localStorage / 系统偏好上屏，本组件接管后续切换。
 */
export function ThemeToggle({ className = "size-7" }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const dark = mode === "dark" || (mode === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [mode]);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const current = META[mode];
  const Icon = current.icon;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label="切换主题"
      title={current.label}
      className={`flex ${className} items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground`}
    >
      <Icon className="size-4" />
    </button>
  );
}
