import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AskCommandDialog } from "@/components/ask-command-dialog";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-[100dvh]">
          <SidebarNav />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <AskCommandDialog />
      </body>
    </html>
  );
}
