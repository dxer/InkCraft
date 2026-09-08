#!/bin/sh
set -e

# 确保持久化数据目录存在并具备写入权限
mkdir -p /app/data

# 若以 root 启动，将数据目录所有权赋予安全非 root 用户 (node)，并降权运行
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /app/data
  exec su-exec node "$@"
else
  exec "$@"
fi
