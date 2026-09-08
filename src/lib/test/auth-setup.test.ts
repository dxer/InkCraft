import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// 无 ACCESS_PASSWORD env → 走 DB 兜底路径
delete process.env.ACCESS_PASSWORD;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inkcraft-auth-test-"));
process.env.INKCRAFT_DB_PATH = path.join(tmpDir, "auth.sqlite");

import {
  generateSessionToken,
  getAccessPassword,
  isAuthConfigured,
  isSecureRequest,
  setAccessPassword,
  verifySessionToken,
} from "../auth";

before(() => {
  getAccessPassword();
});

test("无口令时：未配置、验证失败（不产生匿名会话）", () => {
  assert.equal(isAuthConfigured(), false);
  assert.equal(verifySessionToken(undefined), false);
});

test("设置口令后：落库、验证通过、同签发时间 token 稳定", () => {
  setAccessPassword("my-pass-1234");
  assert.equal(isAuthConfigured(), true);
  assert.equal(getAccessPassword(), "my-pass-1234");
  const now = Date.now();
  const token = generateSessionToken("my-pass-1234", now);
  assert.match(token, /^ink_\d+\.[0-9a-f]{64}$/);
  assert.equal(generateSessionToken("my-pass-1234", now), token);
  assert.equal(verifySessionToken(token), true);
  assert.equal(verifySessionToken("wrong"), false);
  // 异长 token 直接拒绝
  assert.equal(verifySessionToken(token + "x"), false);
});

test("口令变更后旧 token 失效", () => {
  const oldToken = generateSessionToken("my-pass-1234", Date.now());
  setAccessPassword("new-pass-5678");
  assert.equal(verifySessionToken(oldToken), false);
  assert.equal(verifySessionToken(generateSessionToken("new-pass-5678")), true);
});

test("超过最大年龄、签发时间异常或旧格式的 token 拒绝", () => {
  const expired = generateSessionToken(
    "new-pass-5678",
    Date.now() - 31 * 24 * 60 * 60 * 1000,
  );
  assert.equal(verifySessionToken(expired), false);
  const future = generateSessionToken(
    "new-pass-5678",
    Date.now() + 10 * 60 * 1000,
  );
  assert.equal(verifySessionToken(future), false);
  // 旧格式（无时间戳部分）token 直接拒绝
  assert.equal(verifySessionToken("ink_abc123"), false);
});

test("isSecureRequest：HTTP 直连 false，X-Forwarded-Proto 仅在 TRUST_PROXY 下生效，COOKIE_SECURE 可强制覆盖", () => {
  const httpReq = new Request("http://server:3000/api/auth/login");
  assert.equal(isSecureRequest(httpReq), false);

  const proxiedHttps = new Request("http://server:3000/api/auth/login", {
    headers: { "x-forwarded-proto": "https" },
  });
  // 默认不信任代理头（可被请求方伪造）：XFP 不生效
  assert.equal(isSecureRequest(proxiedHttps), false);

  process.env.TRUST_PROXY = "true";
  assert.equal(isSecureRequest(proxiedHttps), true);
  delete process.env.TRUST_PROXY;

  process.env.COOKIE_SECURE = "true";
  assert.equal(isSecureRequest(httpReq), true);
  process.env.COOKIE_SECURE = "false";
  assert.equal(isSecureRequest(proxiedHttps), false);
  delete process.env.COOKIE_SECURE;
});
