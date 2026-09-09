import assert from "node:assert/strict";
import test from "node:test";
import {
  handleMcpJsonRpc,
  MCP_TOOLS,
  MCP_RESOURCES,
} from "../mcp-server";
import { getDb } from "../db";
import { randomUUID } from "node:crypto";

test("mcp-server: initialize 握手返回协议版本与能力", async () => {
  const res = await handleMcpJsonRpc(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    },
    "Test Agent",
  );

  assert.equal(res.jsonrpc, "2.0");
  assert.equal(res.id, 1);
  assert.equal(res.result.serverInfo.name, "inkcraft-mcp-server");
  assert.equal(res.result.serverInfo.authenticatedAs, "Test Agent");
});

test("mcp-server: tools/list 返回 9 大核心只读工具", async () => {
  const res = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });

  assert.equal(res.id, 2);
  const tools = res.result.tools;
  assert.equal(tools.length, 9);

  const toolNames = tools.map((t: any) => t.name);
  // 1. 卡片层
  assert.ok(toolNames.includes("search_cards_by_query"));
  assert.ok(toolNames.includes("get_card_detail"));
  // 2. 文档语料层
  assert.ok(toolNames.includes("list_knowledge_bases"));
  assert.ok(toolNames.includes("search_documents"));
  assert.ok(toolNames.includes("get_document_detail"));
  // 3. 网状关联层
  assert.ok(toolNames.includes("find_related_cards"));
  assert.ok(toolNames.includes("list_tags_and_concepts"));
  // 4. 选题与作品层
  assert.ok(toolNames.includes("list_topics"));
  assert.ok(toolNames.includes("list_recent_works"));
});

test("mcp-server: tools/call 执行 search_cards_by_query 支持 include_content", async () => {
  const res = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "search_cards_by_query",
      arguments: {
        query: "工作 认知",
        include_content: true,
        limit: 3,
      },
    },
  });

  assert.equal(res.id, 3);
  assert.equal(res.result.isError, false);
  const content = JSON.parse(res.result.content[0].text);
  assert.equal(typeof content.total_matched, "number");
  assert.ok(Array.isArray(content.cards));
});

test("mcp-server: tools/call 执行 get_card_detail (单卡与批量 card_ids)", async () => {
  const db = getDb();
  const testDocId = `test_doc_${Date.now()}`;
  const testCardId1 = `card_test_${randomUUID()}`;
  const testCardId2 = `card_test_${randomUUID()}`;

  db.prepare(`
    INSERT INTO knowledge_items (id, title, content, kb_id)
    VALUES (?, ?, ?, 'default')
  `).run(testDocId, "测试母档", "测试正文");

  db.prepare(`
    INSERT INTO knowledge_cards (id, document_id, content_md)
    VALUES (?, ?, ?)
  `).run(testCardId1, testDocId, `---\ntitle: "单测卡片1"\ntags: ["测试"]\n---\n### 核心机制\n机制1`);

  db.prepare(`
    INSERT INTO knowledge_cards (id, document_id, content_md)
    VALUES (?, ?, ?)
  `).run(testCardId2, testDocId, `---\ntitle: "单测卡片2"\ntags: ["测试"]\n---\n### 核心机制\n机制2`);

  // 1. 单卡查询
  const singleRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 31,
    method: "tools/call",
    params: {
      name: "get_card_detail",
      arguments: {
        card_id: testCardId1,
      },
    },
  });

  assert.equal(singleRes.result.isError, false);
  const singleData = JSON.parse(singleRes.result.content[0].text);
  assert.equal(singleData.card_id, testCardId1);
  assert.equal(singleData.claim, "单测卡片1");

  // 2. 批量卡片查询
  const batchRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 32,
    method: "tools/call",
    params: {
      name: "get_card_detail",
      arguments: {
        card_ids: [testCardId1, testCardId2],
      },
    },
  });

  assert.equal(batchRes.result.isError, false);
  const batchData = JSON.parse(batchRes.result.content[0].text);
  assert.equal(batchData.total, 2);
  assert.equal(batchData.cards.length, 2);
});

test("mcp-server: tools/call 执行 list_knowledge_bases, search_documents, get_document_detail", async () => {
  const db = getDb();
  const docId = `doc_${randomUUID()}`;
  const cardId = `card_doc_${randomUUID()}`;

  db.prepare(`
    INSERT INTO knowledge_items (id, title, content, kb_id, category, tags)
    VALUES (?, '深度学习与认知重构笔记', '这是一篇关于多任务切换与认知负荷的长篇研究文档正文。', 'default', 'AI认知', '["认知科学","深度学习"]')
  `).run(docId);

  db.prepare(`
    INSERT INTO knowledge_cards (id, document_id, content_md)
    VALUES (?, ?, ?)
  `).run(cardId, docId, `---\ntitle: "认知负荷理论"\n---\n### 核心机制\n人类工作记忆容量有限。`);

  // 1. list_knowledge_bases
  const kbRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 35,
    method: "tools/call",
    params: {
      name: "list_knowledge_bases",
      arguments: {},
    },
  });
  assert.equal(kbRes.result.isError, false);
  const kbData = JSON.parse(kbRes.result.content[0].text);
  assert.ok(kbData.total >= 1);
  assert.ok(kbData.knowledge_bases.some((k: any) => k.id === "default"));

  // 2. search_documents
  const searchDocRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 36,
    method: "tools/call",
    params: {
      name: "search_documents",
      arguments: {
        query: "多任务切换",
      },
    },
  });
  assert.equal(searchDocRes.result.isError, false);
  const searchDocData = JSON.parse(searchDocRes.result.content[0].text);
  assert.ok(searchDocData.documents.some((d: any) => d.document_id === docId));

  // 3. get_document_detail
  const docDetailRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 37,
    method: "tools/call",
    params: {
      name: "get_document_detail",
      arguments: {
        document_id: docId,
      },
    },
  });
  assert.equal(docDetailRes.result.isError, false);
  const docDetailData = JSON.parse(docDetailRes.result.content[0].text);
  assert.equal(docDetailData.document_id, docId);
  assert.equal(docDetailData.title, "深度学习与认知重构笔记");
  assert.ok(docDetailData.extracted_cards.length >= 1);
  assert.equal(docDetailData.extracted_cards[0].card_id, cardId);
});

test("mcp-server: tools/call 执行 find_related_cards 与 list_tags_and_concepts", async () => {
  const db = getDb();
  const docId = `doc_rel_${randomUUID()}`;
  const rootCardId = `card_root_${randomUUID()}`;
  const relatedCardId = `card_sub_${randomUUID()}`;

  db.prepare(`
    INSERT INTO knowledge_items (id, title, content, kb_id)
    VALUES (?, '关联笔记母档', '正文内容')
  `).run(docId);

  // rootCard 带有 connection_hints: ["注意力残留"]
  db.prepare(`
    INSERT INTO knowledge_cards (id, document_id, content_md)
    VALUES (?, ?, ?)
  `).run(rootCardId, docId, `---\ntitle: "任务切换代价"\nconnection_hints: ["注意力残留", "认知负荷"]\ntags: ["效能"]\n---\n### 核心机制\n频繁切换导致注意力碎片化。`);

  // relatedCard 命中 connection_hints
  db.prepare(`
    INSERT INTO knowledge_cards (id, document_id, content_md)
    VALUES (?, ?, ?)
  `).run(relatedCardId, docId, `---\ntitle: "注意力残留理论"\ntags: ["效能", "心理学"]\n---\n### 核心机制\n前一个未完成任务会在脑海持续消耗带宽。`);

  // 1. find_related_cards
  const relRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 38,
    method: "tools/call",
    params: {
      name: "find_related_cards",
      arguments: {
        card_id: rootCardId,
        limit: 5,
      },
    },
  });
  assert.equal(relRes.result.isError, false);
  const relData = JSON.parse(relRes.result.content[0].text);
  assert.equal(relData.source_card.card_id, rootCardId);
  assert.ok(relData.related_cards.some((c: any) => c.card_id === relatedCardId));

  // 2. list_tags_and_concepts
  const tagsRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 39,
    method: "tools/call",
    params: {
      name: "list_tags_and_concepts",
      arguments: {},
    },
  });
  assert.equal(tagsRes.result.isError, false);
  const tagsData = JSON.parse(tagsRes.result.content[0].text);
  assert.ok(tagsData.total_concepts >= 1);
  assert.ok(tagsData.top_concepts.some((c: any) => c.concept === "注意力残留" || c.concept === "认知负荷"));
});

test("mcp-server: tools/call 执行 list_topics (搜索、排除、排序与内联卡片)", async () => {
  const db = getDb();
  const topicId1 = `top_test_${randomUUID()}`;
  const topicId2 = `top_test_${randomUUID()}`;
  const title1 = `深度工作难以维系_${randomUUID()}`;
  const title2 = `知识管理悖论_${randomUUID()}`;

  db.prepare(`
    INSERT OR REPLACE INTO topic_repository (id, title, angle, hook, target_skill, score, status)
    VALUES (?, ?, '注意力残余假说', '你以为的多任务切换其实是在摧毁专注', 'wechat', 95, 'idea')
  `).run(topicId1, title1);

  db.prepare(`
    INSERT OR REPLACE INTO topic_repository (id, title, angle, hook, target_skill, score, status)
    VALUES (?, ?, '卡片盒笔记法的重构', '记录得越多反而思考得越少？', 'zhihu', 92, 'idea')
  `).run(topicId2, title2);

  // 1. 关键词 query 搜索
  const searchTopicRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 41,
    method: "tools/call",
    params: {
      name: "list_topics",
      arguments: {
        query: "深度工作",
        order_by: "score",
      },
    },
  });

  assert.equal(searchTopicRes.result.isError, false);
  const searchData = JSON.parse(searchTopicRes.result.content[0].text);
  assert.ok(searchData.topics.some((t: any) => t.title.includes("深度工作")));

  // 2. exclude_ids 排除测试
  const excludeRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 42,
    method: "tools/call",
    params: {
      name: "list_topics",
      arguments: {
        exclude_ids: [topicId1],
        order_by: "random",
      },
    },
  });

  assert.equal(excludeRes.result.isError, false);
  const excludeData = JSON.parse(excludeRes.result.content[0].text);
  assert.ok(!excludeData.topics.some((t: any) => t.topic_id === topicId1));
});

test("mcp-server: tools/call 执行 list_recent_works 支持搜索与完整母稿", async () => {
  const db = getDb();
  const projId = `proj_${randomUUID()}`;
  db.prepare(`
    INSERT INTO pipeline_projects (id, title, current_stage, master_content, target_skill)
    VALUES (?, '论深度写作的复利效应', 'completed', '# 论深度写作的复利效应\n\n正文开始展开详细论证...', 'wechat')
  `).run(projId);

  const res = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 51,
    method: "tools/call",
    params: {
      name: "list_recent_works",
      arguments: {
        query: "复利效应",
        include_full_content: true,
        limit: 1,
      },
    },
  });

  assert.equal(res.result.isError, false);
  const data = JSON.parse(res.result.content[0].text);
  assert.ok(data.total >= 1);
  const work = data.works[0];
  assert.ok(work.title.includes("复利效应"));
  assert.ok(work.full_content_md.includes("正文开始展开详细论证"));
});

test("mcp-server: resources/list 与 resources/read", async () => {
  const listRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 61,
    method: "resources/list",
  });

  assert.equal(listRes.id, 61);
  assert.equal(listRes.result.resources.length, 2);

  const readRes = await handleMcpJsonRpc({
    jsonrpc: "2.0",
    id: 62,
    method: "resources/read",
    params: {
      uri: "inkcraft://stats/summary",
    },
  });

  assert.equal(readRes.id, 62);
  const stats = JSON.parse(readRes.result.contents[0].text);
  assert.equal(typeof stats.total_atomic_cards, "number");
  assert.equal(typeof stats.total_topics_in_radar, "number");
});
