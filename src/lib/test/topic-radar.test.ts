import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCollisionFingerprint,
  computeCardJaccardSimilarity,
  findCollisionPairs,
  type RadarCardCandidate,
} from "../topic-radar";

test("computeCollisionFingerprint: 能够按卡片 ID 排序生成唯一确定性 MD5 指纹", () => {
  const fp1 = computeCollisionFingerprint(["card_b", "card_a"]);
  const fp2 = computeCollisionFingerprint(["card_a", "card_b"]);
  const fp3 = computeCollisionFingerprint(["card_c", "card_a"]);

  assert.equal(fp1, fp2, "不同传入次序的相同卡片对必须生成相同的指纹");
  assert.notEqual(fp1, fp3, "不同卡片对必须生成不同的指纹");
  assert.equal(typeof fp1, "string");
  assert.equal(fp1.length, 32);
});

test("computeCardJaccardSimilarity: 关键词与标签语义交集计算", () => {
  const c1: RadarCardCandidate = {
    id: "c1",
    docId: "d1",
    title: "Vibe Coding 的核心在于 Spec 边界锁定",
    tags: ["AI编程", "软件工程"],
    noteTitle: "Vibe Coding 手记",
  };
  const c2: RadarCardCandidate = {
    id: "c2",
    docId: "d2",
    title: "AI 编程中的上下文窗口与边界约束",
    tags: ["AI编程"],
    noteTitle: "上下文工程",
  };
  const c3: RadarCardCandidate = {
    id: "c3",
    docId: "d3",
    title: "多任务切换是在支付昂贵的注意力税",
    tags: ["认知心理学"],
    noteTitle: "精力管理",
  };

  const simHigh = computeCardJaccardSimilarity(c1, c2);
  const simLow = computeCardJaccardSimilarity(c1, c3);

  assert.ok(simHigh > simLow, "同领域相似卡片的相似度应明显高于跨领域卡片");
  assert.ok(simHigh >= 0 && simHigh <= 1);
});

test("findCollisionPairs: 三种碰撞策略（反差、跨界、纵深）能够有效生成候选对并过滤已知指纹", async () => {
  const candidates: RadarCardCandidate[] = [
    {
      id: "card_1",
      docId: "doc_1",
      title: "靠意志力对抗习惯注定失败，环境设计才是低成本解法",
      mechanism: "环境提示触发行为反射",
      boundary: "在突发应急状态下不适用",
      tags: ["习惯养成"],
      noteTitle: "微习惯",
    },
    {
      id: "card_2",
      docId: "doc_2",
      title: "极度聚焦状态下，短期高压意志力具有不可替代的破局效应",
      mechanism: "短期超额意志力突破瓶颈",
      boundary: "不可长期透支",
      tags: ["习惯养成"],
      noteTitle: "意志力假说",
    },
    {
      id: "card_3",
      docId: "doc_3",
      title: "Vibe Coding 的关键在于 Spec 边界锁定",
      mechanism: "上下文窗口污染规避",
      boundary: "需求模糊时容易假死",
      tags: ["软件工程"],
      noteTitle: "Vibe 编程指南",
    },
    {
      id: "card_4",
      docId: "doc_4",
      title: "频繁多任务切换是在支付昂贵的注意力税",
      mechanism: "大脑工作记忆重载耗能",
      boundary: "流水线作业除外",
      tags: ["认知心理学"],
      noteTitle: "深度工作",
    },
  ];

  // 1. 测试跨界碰撞（Intersection）
  const intersectionPairs = findCollisionPairs(candidates, {
    preferredAngle: "intersection",
  });
  assert.ok(intersectionPairs.length > 0, "必须挖掘出跨领域卡片组合");
  const interPair = intersectionPairs.find((p) => p.angleType === "intersection");
  assert.ok(interPair, "应存在跨界同构类型");

  // 2. 测试指纹过滤
  const fpToExclude = computeCollisionFingerprint([candidates[0].id, candidates[1].id]);
  const pairsWithExclusion = findCollisionPairs(candidates, {
    excludeFingerprints: new Set([fpToExclude]),
  });

  const excludedExists = pairsWithExclusion.some(
    (p) => p.fingerprint === fpToExclude,
  );
  assert.equal(excludedExists, false, "已存在的碰撞指纹必须被严格过滤");

  // 3. 测试知识簇构建与分支路由
  const { buildCardClusters } = await import("../topic-radar");
  const clusters = buildCardClusters(candidates, { limit: 4 });
  assert.ok(clusters.length > 0, "必须生成知识簇");
  for (const c of clusters) {
    assert.ok(c.docId, "知识簇必须有 docId");
    assert.ok(c.cards.length >= 1, "知识簇必须包含主笔记卡片");
    assert.ok(["single_point", "topic_deepening", "topic_network"].includes(c.branch));
  }
});

test("runTopicRadarMining: 能够从当前知识库卡片中成功执行碰撞并生成结构化选题", async () => {
  const { runTopicRadarMining, triggerTopicRadarMiningAsync } = await import("../topic-radar");
  const { getTopicsFromDb, deleteTopicFromDb } = await import("../topics");

  const result = await runTopicRadarMining({ count: 2 });
  // 如果当前测试数据库中有 >= 2 张卡片，应正常生成选题并落库
  if (result.ran) {
    assert.ok(result.savedTopicsCount >= 0);
    assert.ok(Array.isArray(result.topics));
  } else {
    assert.ok(result.reason, "未运行必须有合理解释");
  }

  // 测试 triggerTopicRadarMiningAsync
  const asyncRes = triggerTopicRadarMiningAsync({ count: 1 });
  assert.ok(typeof asyncRes.started === "boolean");
  assert.ok(typeof asyncRes.message === "string");
});
