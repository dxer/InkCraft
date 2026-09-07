import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./db";

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  keyValue: string;
  createdAt: string;
  lastUsedAt: string | null;
  status: "active" | "revoked";
}

export interface ApiKeyCreatedResult {
  id: string;
  name: string;
  rawKey: string;
  keyPrefix: string;
  createdAt: string;
}

interface ApiKeyRow {
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  key_value: string | null;
  created_at: string;
  last_used_at: string | null;
  status: string;
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey.trim()).digest("hex");
}

/**
 * 创建新 API 密钥
 * - 生成格式: ink_live_<32位十六进制>
 * - 保存 key_value 便于创作者随时复制
 */
export function generateApiKey(name: string): ApiKeyCreatedResult {
  const db = getDb();
  const trimmedName = (name || "").trim() || "外部 Agent 密钥";
  const randomHex = randomBytes(16).toString("hex");
  const rawKey = `ink_live_${randomHex}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = `ink_live_${randomHex.slice(0, 6)}...`;
  const id = `key_${randomBytes(8).toString("hex")}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO api_keys (id, name, key_hash, key_prefix, key_value, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(id, trimmedName, keyHash, keyPrefix, rawKey, now);

  return {
    id,
    name: trimmedName,
    rawKey,
    keyPrefix,
    createdAt: now,
  };
}

/**
 * 校验 API 密钥有效性并异步记录最后调用时间
 */
export function verifyApiKey(rawKey: string): { valid: boolean; keyId?: string; name?: string } {
  if (!rawKey || typeof rawKey !== "string") {
    return { valid: false };
  }

  const cleanKey = rawKey.trim();
  if (!cleanKey.startsWith("ink_live_") && !cleanKey.startsWith("ink_sk_")) {
    return { valid: false };
  }

  const db = getDb();
  const hash = hashApiKey(cleanKey);

  const row = db.prepare(`
    SELECT id, name, status
    FROM api_keys
    WHERE key_hash = ? AND status = 'active'
  `).get(hash) as { id: string; name: string; status: string } | undefined;

  if (!row) {
    return { valid: false };
  }

  // 异步更新最后活跃时间
  try {
    db.prepare(`
      UPDATE api_keys
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(row.id);
  } catch {
    // 忽略时间写入失败
  }

  return {
    valid: true,
    keyId: row.id,
    name: row.name,
  };
}

/**
 * 查询所有 API 密钥（包含可复制的明文）
 */
export function listApiKeys(): ApiKeyItem[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, name, key_prefix, key_value, created_at, last_used_at, status
    FROM api_keys
    ORDER BY created_at DESC
  `).all() as ApiKeyRow[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    keyPrefix: r.key_prefix,
    keyValue: r.key_value || r.key_prefix,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    status: (r.status as "active" | "revoked") || "active",
  }));
}

/**
 * 物理删除 API 密钥
 */
export function deleteApiKey(id: string): boolean {
  const db = getDb();
  const res = db.prepare(`DELETE FROM api_keys WHERE id = ?`).run(id);
  return res.changes > 0;
}

/**
 * 撤销/禁用 API 密钥
 */
export function revokeApiKey(id: string): boolean {
  const db = getDb();
  const res = db.prepare(`UPDATE api_keys SET status = 'revoked' WHERE id = ?`).run(id);
  return res.changes > 0;
}
