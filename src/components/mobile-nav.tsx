"use client";

import {
  BookOpen,
  Home,
  IdCard,
  Brain,
  Library,
  Lightbulb,
  Menu,
  Search,
  Settings,
  Tag,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
      { href: "/knowledge", label: "全部笔记", icon: BookOpen },
      { href: "/cards", label: "知识卡片", icon: IdCard },
      { href: "/tags", label: "标签索引", icon: Tag },
    ],
  },
  {
    title: "灵感与作品",
    items: [
      { href: "/topics", label: "选题雷达", icon: Lightbulb },
      { href: "/works", label: "作品库", icon: Library },
      { href: "/agents", label: "创作技能", icon: Users },
    ],
  },
] as const;

const FOOTER_LINKS = [
  { href: "/settings", label: "系统设置", icon: Settings },
] as const;

/** 移动端顶栏 + 抽屉导航（桌面端不渲染）。与桌面侧边栏同样在登录页 / 知识库工作台隐藏。 */
export function MobileTopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === "/login" || /^\/knowledge\/[^/]+/.test(pathname)) {
    return null;
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const close = () => setOpen(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b bg-background px-3 md:hidden">
        <Link href="/" className="flex items-center gap-2" aria-label="回到首页">
          <InkCraftMark className="size-6 text-foreground" />
          <span className="text-sm font-semibold">墨匠</span>
        </Link>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="搜索"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="size-4" />
          </button>
          <ThemeToggle className="size-8" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="打开导航菜单"
            aria-expanded={open}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </header>

      {/* 抽屉 */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/25"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav className="absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-background shadow-xl">
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
              <div className="flex items-center gap-2">
                <InkCraftMark className="size-6 text-foreground" />
                <span className="text-sm font-semibold">墨匠</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭导航菜单"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {SECTIONS.map((section, idx) => (
                <div key={idx} className="mb-4 space-y-1">
                  {section.title && (
                    <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      {section.title}
                    </div>
                  )}
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors ${
                        isActive(item.href)
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>

            <div className="shrink-0 border-t p-3">
              {FOOTER_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors ${
                    isActive(item.href)
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
