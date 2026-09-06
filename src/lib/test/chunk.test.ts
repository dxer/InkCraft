import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../chunk.ts";

test("短文档合并为单块,标题与段落保留", () => {
  const text = "# 第一章\n\n段落甲。\n\n段落乙。\n\n## 小结\n\n末尾内容。";
  const chunks = chunkText(text);
  assert.equal(chunks.length, 1);
  assert.ok(chunks[0].includes("第一章") && chunks[0].includes("小结"));
});

test("长文档按目标块长(≤1000 字)分块", () => {
  const section = (i: number) =>
    `# 第${i}章\n\n` +
    Array.from(
      { length: 30 },
      () => "这是一段用于累积到目标块长的正文内容。",
    ).join("");
  const text = Array.from({ length: 8 }, (_, i) => section(i)).join("\n\n");
  const chunks = chunkText(text);
  assert.ok(chunks.length > 1, "长文应切出多块");
  assert.ok(
    chunks.every((c) => [...c].length <= 1000),
    "每块不超过硬上限",
  );
});

test("空文本返回空数组", () => {
  assert.deepEqual(chunkText("   \n "), []);
});
