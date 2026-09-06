import assert from "node:assert/strict";
import test from "node:test";

import { estimatePackedChars, packChunk } from "../pack.ts";

test("packChunk 短文本原样保留", () => {
  const text = "认知溢价来自帮用户节省认知成本。";
  assert.equal(packChunk(text), text);
});

test("packChunk 长文本压缩到预算内且保留首句", () => {
  const long =
    "碎片化内容天然具备两个特征：一是去语境化，二是无关联性。深度内容不追求瞬时点击，而追求持续信任，这让信任变成了可以复利的资产。她入职第一个月几乎没产出，上个月合并约 1000 个 PR，这个数字让整个团队重新审视了 Agent 的上限。";
  const packed = packChunk(long, 150);
  assert.ok(packed.length <= 150, `should be <= 150, got ${packed.length}`);
  assert.ok(packed.startsWith("碎片化内容"), "应以首句开头");
});

test("packChunk 优先保留含数字的句子", () => {
  const filler = "这一段没有任何关键信息，只是普通的铺垫说明文字而已。";
  const evidence = "上个月合并约 1000 个 PR，本月 12 号已近 800 个。";
  const long = `${filler}${filler}${filler}${evidence}`;
  const packed = packChunk(long, 150);
  assert.ok(packed.includes("1000"), "应保留含数字的证据句");
});

test("estimatePackedChars 按上限截断估算", () => {
  assert.equal(estimatePackedChars(["短文本", "x".repeat(300)]), 3 + 150);
});
