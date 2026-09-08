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

# 3. 生产打包构建
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# 4. 生产运行阶段
FROM base AS runner
# 安装运行时工具（ca 证书、时区支持、curl 用于容器健康检查）
RUN apk add --no-cache ca-certificates tzdata curl

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV TZ="Asia/Shanghai"

# 准备持久化数据目录并赋予非 root 权限
RUN mkdir -p /app/data && \
    chown -R node:node /app/data

# 复制生产运行所需的构建物与依赖
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=node:node /app/pnpm-workspace.yaml* ./pnpm-workspace.yaml
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts

# 切换为安全非 root 用户
USER node

EXPOSE 3000

# SQLite 数据库持久化目录
VOLUME ["/app/data"]

# 容器健康检查（/login 为免鉴权公开路径；/api/settings 在门禁开启后返回 401，会导致永远 unhealthy）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/login || exit 1

CMD ["pnpm", "start"]
