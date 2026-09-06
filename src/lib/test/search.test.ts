import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

// 临时 DB：db.ts 在首次 getDb() 时读取 INKCRAFT_DB_PATH 建库并自动迁移
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "inkcraft-test-"));
process.env.INKCRAFT_DB_PATH = path.join(tmpDir, "test.sqlite");

import { getDb } from "../db";
import {
  ftsSearchNotes,
  likeSearchNotes,
  ftsSearchWorks,
  likeSearchWorks,
} from "../search";

const db = getDb();

function insertNote(
  content: string,
  title: string | null = null,
  chunkIndex: number | null = null,
) {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO knowledge_items (id, kb_id, document_id, chunk_index, title, content, item_type, category) VALUES (?, 'default', NULL, ?, ?, ?, 'note', '通用')",
  ).run(id, chunkIndex, title, content);
  return id;
}

before(() => {
  insertNote("人工智能与写作流水线：把原料锻造成作品。", "AI 写作");
  insertNote("notebook 与知识管理实践。", null);
  insertNote("# 切片正文（chunk）不应该被笔记检索命中。", null, 2);
});

after(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("FTS 命中 ≥3 字符中文子串,切片行不在命中列", () => {
  const hits = ftsSearchNotes(db, "写作流水");
  assert.equal(hits?.length, 1, "应命中笔记而非切片");
});

test("短词时 FTS 返回 null（调用方走 LIKE 降级）", () => {
  assert.equal(ftsSearchNotes(db, "好"), null);
});

test("likeSearchNotes 命中内容/标题,排除切片,通配符被转义", () => {
  assert.ok(likeSearchNotes(db, "notebook").length >= 1, "应按内容命中");
  assert.equal(
    likeSearchNotes(db, "切片正文").length,
    0,
    "切片行不应被笔记级检索命中",
  );
  assert.equal(
    likeSearchNotes(db, "%").length,
    0,
    "% 应被转义为字面量而非通配",
  );
});

test("works 检索原语:LIKE 命中标题;无匹配时 FTS 返回空数组可继续走降级", () => {
  const pid = randomUUID();
  db.prepare(
    "INSERT INTO pipeline_projects (id, title, current_stage, selected_topic, master_content) VALUES (?, '一篇关于装配的成品', 'review', NULL, '# 正文')",
  ).run(pid);

  const fts = ftsSearchWorks(db, "装配作业");
  assert.ok(
    fts === null || (Array.isArray(fts) && fts.length === 0),
    "查询合法但不含目标子串:应返回 null(短词)或空数组",
  );
  assert.ok(likeSearchWorks(db, "装配").includes(pid), "LIKE 降级应命中标题");
});
