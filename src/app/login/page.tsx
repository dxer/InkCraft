import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginForm } from "./login-form";

// 声明为动态渲染，杜绝 Next.js App Router 将登录页静态预渲染并发送长效缓存头 (s-maxage=31536000)，
// 确保内嵌浏览器或任何客户端打开/刷新时都能立刻获得最新页面
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-background">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-foreground" />
            <span>正在连接工坊环境...</span>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
