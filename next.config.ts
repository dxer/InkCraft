import type { NextConfig } from "next";

// 远程 IP 访问 dev server 时放行 dev 资源（否则 JS 加载被拦、页面无法 hydration）。
// 白名单完全来自 ALLOWED_DEV_ORIGINS 环境变量（逗号分隔），仅在 next dev 下生效。
const devOriginsFromEnv = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  // better-sqlite3 是原生模块，必须排除出打包流程，运行时直接 require
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: devOriginsFromEnv,
};

export default nextConfig;
