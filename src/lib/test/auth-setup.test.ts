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

test("设置口令后：落库、验证通过、token 稳定", () => {
  setAccessPassword("my-pass-1234");
  assert.equal(isAuthConfigured(), true);
  assert.equal(getAccessPassword(), "my-pass-1234");
  const token = generateSessionToken("my-pass-1234");
  assert.equal(verifySessionToken(token), true);
  assert.equal(verifySessionToken("wrong"), false);
});
