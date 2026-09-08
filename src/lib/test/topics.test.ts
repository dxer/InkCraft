import { test } from "node:test";
import assert from "node:assert/strict";
import { setSetting } from "../settings";
import { triggerTopicRadarMiningAsync } from "../topic-radar";
import {
  batchSaveTopicsToRepository,
  checkAndMineHourlyTopics,
  deleteTopicFromDb,
  getTopicMiningState,
  getTopicStats,
  getTopicsFromDb,
  saveTopicToRepository,
  SETTING_KEY_MINING_STARTED_AT,
  SETTING_KEY_MINING_STATUS,
  updateTopicStatusInDb,
} from "../topics";

test("saveTopicToRepository: 基础保存与严格查重", () => {
  const uniqueTitle = `测试选题_${Date.now()}_A`;
  const res1 = saveTopicToRepository({
    title: uniqueTitle,
    angle: "深入分析知识管理与卡片盒",
    targetSkill: "wechat",
    outline: ["一、背景", "二、论证", "三、结论"],
  });

  assert.equal(res1.created, true);
  assert.equal(res1.topic.title, uniqueTitle);
  assert.equal(res1.topic.status, "idea");
  assert.equal(res1.topic.targetSkill, "wechat");
  assert.equal(res1.topic.outline.length, 3);

  // 相同标题二次保存：禁止重复落库，返回已存在的记录
  const res2 = saveTopicToRepository({
    title: uniqueTitle,
    angle: "尝试覆盖的切角",
    targetSkill: "zhihu",
  });

  assert.equal(res2.created, false);
  assert.equal(res2.topic.id, res1.topic.id);

  // 清理
  deleteTopicFromDb(res1.topic.id);
});

test("batchSaveTopicsToRepository: 批量保存选题", () => {
  const t1 = `测试批量_${Date.now()}_1`;
  const t2 = `测试批量_${Date.now()}_2`;

  const { savedCount, topics } = batchSaveTopicsToRepository([
    { title: t1, targetSkill: "xiaohongshu" },
    { title: t2, targetSkill: "zhihu" },
    { title: t1, targetSkill: "wechat" }, // 重复项
  ]);

  assert.equal(savedCount, 2);
  assert.equal(topics.length, 3);

  // 清理
  for (const t of topics) {
    deleteTopicFromDb(t.id);
  }
});

test("updateTopicStatusInDb & getTopicsFromDb: 状态更新与条件筛选", () => {
  const testTitle = `测试状态筛选_${Date.now()}`;
  const { topic } = saveTopicToRepository({
    title: testTitle,
    angle: "用于筛选的测试切角",
    targetSkill: "x_thread",
  });

  // 初始为 idea
  let list = getTopicsFromDb({ search: testTitle, status: "idea" });
  assert.equal(list.length, 1);
  assert.equal(list[0].status, "idea");

  // 更新为 used
  const ok = updateTopicStatusInDb(topic.id, "used");
  assert.equal(ok, true);

  list = getTopicsFromDb({ search: testTitle, status: "used" });
  assert.equal(list.length, 1);
  assert.equal(list[0].status, "used");

  // 技能筛选
  const xList = getTopicsFromDb({ targetSkill: "x_thread", search: testTitle });
  assert.equal(xList.length, 1);

  const wechatList = getTopicsFromDb({ targetSkill: "wechat", search: testTitle });
  assert.equal(wechatList.length, 0);

  // 清理
  deleteTopicFromDb(topic.id);
});

test("checkAndMineHourlyTopics: 无新笔记时自动跳过，不消耗 Token", async () => {
  // 确保重置运行锁与上次扫描时间
  setSetting(SETTING_KEY_MINING_STATUS, "idle");
  setSetting("topic_mining.last_scanned_at", new Date(Date.now() + 100000).toISOString());

  const result = await checkAndMineHourlyTopics({ force: true });
  assert.equal(result.ran, false);
  assert.equal(result.newNotesCount, 0);
  assert.match(result.reason || "", /无新收录笔记|跳过选题生成/);
});

test("getTopicMiningState: 正确识别 running 状态与防重复触发", () => {
  // 模拟空闲状态
  setSetting(SETTING_KEY_MINING_STATUS, "idle");
  const s1 = getTopicMiningState();
  assert.equal(s1.isMining, false);

  // 模拟正在运行
  setSetting(SETTING_KEY_MINING_STATUS, "running");
  setSetting(SETTING_KEY_MINING_STARTED_AT, new Date().toISOString());
  const s2 = getTopicMiningState();
  assert.equal(s2.isMining, true);
  assert.equal(s2.status, "running");

  // 正在运行时再次触发必须被拒绝
  const res = triggerTopicRadarMiningAsync({ count: 1 });
  assert.equal(res.started, false);
  assert.match(res.message, /深度碰撞中/);

  // 模拟任务超时自动复位（超过 10 分钟）
  const elevenMinsAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  setSetting(SETTING_KEY_MINING_STATUS, "running");
  setSetting(SETTING_KEY_MINING_STARTED_AT, elevenMinsAgo);

  const s3 = getTopicMiningState();
  assert.equal(s3.isMining, false);
  assert.equal(s3.status, "idle");

  // 清理复位
  setSetting(SETTING_KEY_MINING_STATUS, "idle");
});
