import type { NextConfig } from "next";

// 远程 IP 访问 dev server 时放行 dev 资源（否则 JS 加载被拦、页面无法 hydration）。
// 默认白名单含当前出口 IP；部署环境出口变化时用 ALLOWED_DEV_ORIGINS 环境变量覆盖（逗号分隔）。
const devOriginsFromEnv = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // better-sqlite3 是原生模块，必须排除出打包流程，运行时直接 require
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: [...devOriginsFromEnv, "107.173.127.244"],
};

export default nextConfig;
