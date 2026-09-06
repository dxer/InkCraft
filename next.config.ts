import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 是原生模块，必须排除出打包流程，运行时直接 require
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
