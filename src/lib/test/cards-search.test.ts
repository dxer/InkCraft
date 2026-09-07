import assert from "node:assert/strict";
import test from "node:test";
import { extractKeywords, searchCardsByRelevance } from "../cards-search";

test("cards-search: extractKeywords 提取关键词与过滤停用词", () => {
  const text = "如何通过注意力机制解决深度工作中的认知负荷以及信息过载？";
  const kws = extractKeywords(text);

  assert.ok(kws.includes("注意力"));
  assert.ok(kws.includes("认知负荷") || kws.includes("负荷"));
  assert.ok(kws.includes("信息过载") || kws.includes("过载"));
  assert.ok(!kws.includes("如何"));
  assert.ok(!kws.includes("以及"));
});

test("cards-search: searchCardsByRelevance 能够正常执行检索", () => {
  const res = searchCardsByRelevance({
    query: "注意力 认知",
    limit: 5,
  });

  assert.equal(typeof res.totalMatched, "number");
  assert.ok(Array.isArray(res.results));

  if (res.results.length > 0) {
    const first = res.results[0];
    assert.ok(first.cardId);
    assert.equal(typeof first.relevanceScore, "number");
    assert.ok(first.relevanceScore >= 0 && first.relevanceScore <= 100);
    assert.equal(typeof first.matchedReason, "string");
  }
});
