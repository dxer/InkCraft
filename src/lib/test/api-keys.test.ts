import assert from "node:assert/strict";
import test from "node:test";
import {
  generateApiKey,
  verifyApiKey,
  listApiKeys,
  deleteApiKey,
  hashApiKey,
} from "../api-keys";

test("API Key: 生成密钥、哈希验证与脱敏前缀正确", () => {
  const name = "测试 Claude Agent";
  const created = generateApiKey(name);

  assert.ok(created.id.startsWith("key_"));
  assert.equal(created.name, name);
  assert.ok(created.rawKey.startsWith("ink_live_"));
  assert.equal(created.rawKey.length, "ink_live_".length + 32);
  assert.ok(created.keyPrefix.startsWith("ink_live_"));
  assert.ok(created.keyPrefix.endsWith("..."));

  // 验证有效 Key
  const verified = verifyApiKey(created.rawKey);
  assert.equal(verified.valid, true);
  assert.equal(verified.name, name);

  // 验证无效 Key
  const invalid1 = verifyApiKey("ink_live_invalidkey123456789012345678");
  assert.equal(invalid1.valid, false);

  const invalid2 = verifyApiKey("fake_prefix_xxxx");
  assert.equal(invalid2.valid, false);

  // 查询列表（支持随时复制完整明文）
  const list = listApiKeys();
  const found = list.find((k) => k.id === created.id);
  assert.ok(found);
  assert.equal(found.name, name);
  assert.equal(found.keyPrefix, created.keyPrefix);
  assert.equal(found.keyValue, created.rawKey);

  // 删除 Key
  const deleted = deleteApiKey(created.id);
  assert.equal(deleted, true);

  // 删除后验证失效
  const reVerified = verifyApiKey(created.rawKey);
  assert.equal(reVerified.valid, false);
});
