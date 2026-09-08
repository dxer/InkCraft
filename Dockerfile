# ============================================================
# 墨匠 (InkCraft) - 基于 Alpine Linux 的轻量化生产容器镜像
# ============================================================

# 1. 基础环境
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

# 安装基础运行依赖与 libc 兼容层
RUN apk add --no-cache libc6-compat && \
    corepack enable

# 2. 依赖安装与原生模块编译（better-sqlite3 需要 Python3 & C/C++ 编译器）
FROM base AS deps
RUN apk add --no-cache python3 make g++ gcc
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

# 3. 生产打包构建（输出 Standalone 独立最小运行时）
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# 4. 生产运行阶段（仅包含 Node 运行时与 Standalone 极简产物）
FROM node:22-alpine AS runner
# 安装运行时工具（ca 证书、时区支持、curl 用于容器健康检查、libc6 兼容层、su-exec 权限管理）
RUN apk add --no-cache ca-certificates tzdata curl libc6-compat su-exec

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV TZ="Asia/Shanghai"

# 复制 Next.js Standalone 最小独立产物与静态资源
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

# SQLite 数据库持久化目录
VOLUME ["/app/data"]

# 容器健康检查（/login 为免鉴权公开路径）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/login || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
