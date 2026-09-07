import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AskCommandDialog } from "@/components/ask-command-dialog";
import { MobileTopBar } from "@/components/mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "墨匠 InkCraft",
  description: "本地优先的现代内容工坊：统一知识库 → 四步装配流 → 分发转译",
};

// 首帧阻塞脚本：按 localStorage / 系统偏好提前上屏主题，避免暗色闪白
const themeInitScript = `(function(){try{var t=localStorage.getItem("inkcraft_theme");var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <MobileTopBar />
        <div className="flex min-h-[calc(100dvh-3rem)] md:min-h-[100dvh]">
          <SidebarNav />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <AskCommandDialog />
      </body>
    </html>
  );
}
