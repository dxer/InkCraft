import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "inkcraft-settings-test-"),
);
process.env.INKCRAFT_DB_PATH = path.join(tmpDir, "settings.sqlite");

import { getDb } from "../db";
import { getProviders, getSettings } from "../settings";

const db = getDb();

before(() => {
      // 旧版单机缘字段结构（三文本框时代）
      db.prepare(
            "INSERT INTO app_settings (key, value) VALUES ('byok.providers', ?)",
      ).run(
            JSON.stringify([
                  {
                        id: "p1",
                        name: "DeepSeek",
                        baseUrl: "https://api.deepseek.com/v1",
                        apiKey: "sk-test",
                        textModel: "deepseek-chat",
                  },
            ]),
      );
});

after(() => {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("首次读取迁移旧版字段为 models[],并固化 sentinel", () => {
      const providers = getProviders();
      assert.equal(providers.length, 1);
      assert.deepEqual(providers[0].models, [
            { id: "deepseek-chat", enabled: true, kinds: ["text"] },
      ]);
      assert.equal(
            getSettings()["byok.providers_migrated"],
            "1",
            "sentinel 应已写入",
      );
});

test("sentinel 生效后不再重写 providers 原值", () => {
      const before = getSettings()["byok.providers"];
      getProviders();
      assert.equal(
            getSettings()["byok.providers"],
            before,
            "重复读取不应改动存储值",
      );
});
