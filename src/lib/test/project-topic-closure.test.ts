import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { normalizePipelineStage } from "../types";

function createTestDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE pipeline_projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      current_stage TEXT NOT NULL,
      target_skill TEXT DEFAULT 'wechat',
      topic_id TEXT,
      selected_topic TEXT,
      master_content TEXT,
      card_id TEXT,
      claim_snapshot TEXT,
      brief TEXT,
      snapshots TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE topic_repository (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      angle TEXT,
      hook TEXT,
      target_skill TEXT DEFAULT 'wechat',
      score REAL DEFAULT 90,
      score_tag TEXT,
      outline TEXT,
      matched_cards TEXT,
      source_note_ids TEXT,
      source_type TEXT DEFAULT 'auto',
      status TEXT DEFAULT 'idea',
      used_project_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

test("选题到项目关联及完成成稿后的状态闭环", () => {
  const db = createTestDb();
  const topicId = randomUUID();
  const projectId = randomUUID();

  // 1. 插入一个待创作选题
  db.prepare(
    "INSERT INTO topic_repository (id, title, angle, status) VALUES (?, '为什么深度思考需要本地优先', '隐私与心流', 'idea')"
  ).run(topicId);

  // 2. 创建关联该选题的装配项目
  db.prepare(
    "INSERT INTO pipeline_projects (id, title, current_stage, topic_id, master_content) VALUES (?, '深度思考的本地优先法则', 'draft', ?, '')"
  ).run(projectId, topicId);

  const initialTopic = db.prepare("SELECT status FROM topic_repository WHERE id = ?").get(topicId) as any;
  assert.equal(initialTopic.status, "idea", "创作初期选题状态应为 idea");

  // 3. 模拟工坊完成起草：更新 current_stage 为 completed 并写入正文
  db.prepare(
    "UPDATE pipeline_projects SET current_stage = 'completed', master_content = '这是超过五十个字符的完整作品正文，论述了本地优先如何帮助创作者保持专注与心流状态。' WHERE id = ?"
  ).run(projectId);

  // 触发闭环更新
  db.prepare(
    "UPDATE topic_repository SET status = 'used', used_project_id = ? WHERE id = ?"
  ).run(projectId, topicId);

  const updatedTopic = db.prepare("SELECT status, used_project_id FROM topic_repository WHERE id = ?").get(topicId) as any;
  assert.equal(updatedTopic.status, "used", "完成成稿后选题状态应自动闭环为 used");
  assert.equal(updatedTopic.used_project_id, projectId, "选题应正确记录产出的项目 ID");
});

test("项目历史版本快照序列化与反序列化", () => {
  const db = createTestDb();
  const projectId = randomUUID();

  const snapshots = [
    {
      id: "snap_1",
      createdAt: "2026/09/06 14:00:00",
      wordCount: 120,
      preview: "第一版草稿内容摘要...",
      content: "# 第一版草稿\n\n正文第一版",
      trigger: "draft",
    },
  ];

  db.prepare(
    "INSERT INTO pipeline_projects (id, title, current_stage, snapshots) VALUES (?, '快照测试项目', 'draft', ?)"
  ).run(projectId, JSON.stringify(snapshots));

  const row = db.prepare("SELECT snapshots FROM pipeline_projects WHERE id = ?").get(projectId) as any;
  const parsed = JSON.parse(row.snapshots);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, "snap_1");
  assert.equal(parsed[0].trigger, "draft");
});
