"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Brain,
  BookOpen,
  Home,
  IdCard,
  Library,
  Lightbulb,
  PanelLeftClose,
  Search,
  Settings,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearchDialog } from "@/components/global-search-dialog";
import { InkCraftMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const SECTIONS = [
  {
    title: "创作",
    items: [
      { href: "/", label: "闪念速记", icon: Home },
      { href: "/workshop", label: "创作工坊", icon: Zap },
    ],
  },
  {
    title: "知识库",
    items: [
      { href: "/knowledge", label: "知识库", icon: BookOpen },
      { href: "/cards", label: "知识卡片", icon: IdCard },
      { href: "/tags", label: "标签索引", icon: Tag },
    ],
  },
  {
    title: "灵感与作品",
    items: [
      { href: "/topics", label: "选题雷达", icon: Lightbulb },
      { href: "/works", label: "作品库", icon: Library },
      { href: "/agents", label: "创作技能", icon: Sparkles },
    ],
  },
] as const;

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("inkcraft-sidebar-toggle", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("inkcraft-sidebar-toggle", callback);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("inkcraft_sidebar_collapsed") === "true";
}

function getServerSnapshot(): boolean {
  return false;
}

export function SidebarNav() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const isCollapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggleCollapse = () => {
    const next = !getSnapshot();
    localStorage.setItem("inkcraft_sidebar_collapsed", String(next));
    window.dispatchEvent(new Event("inkcraft-sidebar-toggle"));
  };

  // 独立全屏页面（登录页、独立打开的知识库详情窗口）不展示全局侧边栏
  if (pathname === "/login" || /^\/knowledge\/[^/]+/.test(pathname)) {
    return null;
  }

  return (
    <>
      <aside
        suppressHydrationWarning
        className={`sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r bg-background transition-[width] duration-200 ease-in-out md:flex ${
          isCollapsed ? "w-14" : "w-56"
        }`}
      >
        {/* 顶部 Header：品牌 + 搜索图标 + 折叠按钮 */}
        <div
          className={`flex h-14 items-center border-b ${
            isCollapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center">
              <button
                onClick={toggleCollapse}
                className="flex size-8 items-center justify-center rounded-md transition-transform hover:scale-105 active:scale-95"
                title="墨匠 · 展开侧边栏"
              >
                <InkCraftMark className="size-7 text-foreground" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <InkCraftMark className="size-7 shrink-0 text-foreground" />
                <div className="leading-tight truncate">
                  <div className="text-sm font-semibold">墨匠</div>
                  <div className="text-[10px] tracking-wide text-muted-foreground">
                    INKCRAFT
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setSearchOpen(true)}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="搜索笔记、知识库、成果 (⌘K)"
                >
                  <Search className="size-4" />
                </button>
                <ThemeToggle />
                <button
                  onClick={toggleCollapse}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="收起侧边栏"
                >
                  <PanelLeftClose className="size-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* 折叠模式下的快捷搜索按钮 */}
        {isCollapsed && (
          <div className="flex justify-center border-b p-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="搜索笔记、知识库、成果 (⌘K)"
            >
              <Search className="size-4" />
            </button>
          </div>
        )}

        {/* 主导航菜单 */}
        <nav
          className={`flex-1 space-y-4 overflow-y-auto ${isCollapsed ? "p-2 space-y-3" : "p-3"}`}
        >
          {SECTIONS.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!isCollapsed && section.title && (
                <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  {section.title}
                </div>
              )}
              {isCollapsed && section.title && (
                <div className="my-1 border-t border-muted/50" />
              )}
              {section.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                if (isCollapsed) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={`flex size-9 items-center justify-center mx-auto rounded-md transition-colors ${
                        active
                          ? "bg-muted text-foreground font-medium shadow-xs"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  );
                }

                const cls = active
                  ? "flex items-center gap-2.5 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground"
                  : "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground";
                return (
                  <Link key={item.href} href={item.href} className={cls}>
                    <item.icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* 底部功能区：系统设置 */}
        <div
          className={`border-t ${isCollapsed ? "p-2 space-y-1" : "p-3 space-y-1"}`}
        >
          {isCollapsed ? (
            <>
              <ThemeToggle className="mx-auto size-9" />
              <Link
                href="/settings"
                title="系统设置"
                className={`flex size-9 items-center justify-center mx-auto rounded-md transition-colors ${
                  pathname.startsWith("/settings")
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Settings className="size-4 shrink-0" />
                <span className="sr-only">系统设置</span>
              </Link>
            </>
          ) : (
            <Link
              href="/settings"
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground ${
                pathname.startsWith("/settings")
                  ? "bg-muted text-foreground font-medium"
                  : ""
              }`}
            >
              <Settings className="size-4 shrink-0" />
              <span>系统设置</span>
            </Link>
          )}
        </div>
      </aside>

      {/* 全局搜索弹窗 */}
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
