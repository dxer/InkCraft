import { test } from "node:test";
import assert from "node:assert/strict";
import { mapNote, parseTags, type KnowledgeRow } from "../mappers.ts";
import { normalizePipelineStage } from "../types.ts";
import { markdownLength } from "../utils.ts";

function row(over: Partial<KnowledgeRow>): KnowledgeRow {
  return {
    id: "n1",
    kb_id: "kb1",
    document_id: null,
    chunk_index: null,
    title: "标题",
    content: "正文内容",
    item_type: "note",
    category: "通用",
    tags: null,
    auto_meta: 0,
    created_at: "2026-09-01 10:00:00",
    ...over,
  };
}

test("mapNote 字段映射与字数统计", () => {
  const note = mapNote(
    row({ content: "你好 <b>世界</b>!", tags: JSON.stringify(["a", "b"]) }),
  );
  assert.equal(note.kbId, "kb1");
  assert.equal(note.category, "通用");
  assert.deepEqual(note.tags, ["a", "b"]);
  assert.ok(note.wordCount > 0);
});

test("parseTags 容错:非 JSON / 非数组 / 含非字符串", () => {
  assert.deepEqual(parseTags(null), []);
  assert.deepEqual(parseTags("not json"), []);
  assert.deepEqual(parseTags('[1, "ok"]'), ["ok"]);
});

test("normalizePipelineStage 解析全部阶段并归一历史值", () => {
  assert.equal(normalizePipelineStage("ideate"), "ideate");
  assert.equal(normalizePipelineStage("topic"), "topic");
  assert.equal(normalizePipelineStage("gather"), "gather");
  assert.equal(normalizePipelineStage("draft"), "draft");
  assert.equal(normalizePipelineStage("review"), "review");
  assert.equal(normalizePipelineStage("completed"), "completed");
  // 历史阶段值归一
  assert.equal(normalizePipelineStage("evidence"), "ideate");
  assert.equal(normalizePipelineStage(null), "ideate");
  assert.equal(normalizePipelineStage("garbage"), "ideate");
});

test("markdownLength 统计 Markdown 可见字数", () => {
  const md =
    "# 大标题\n\n正文 **加粗** 和 [链接](https://x.com) 与 `code`。\n\n- 列表项";
  const len = markdownLength(md);
  assert.ok(len > 0);
  assert.ok(len < [...md].length, "应少于原始字符数（标记被剥离）");
  assert.equal(markdownLength("   "), 0);
});
