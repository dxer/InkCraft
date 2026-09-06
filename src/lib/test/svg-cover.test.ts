import test from "node:test";
import assert from "node:assert/strict";
import { extractCleanSvg, validateCoverSvg } from "../svg-cover";

test("extractCleanSvg: 能够从 Markdown 文本中提取纯净 SVG 代码", () => {
  const rawMarkdown = "这是一段解释文本：\n```xml\n<svg viewBox=\"0 0 900 383\"><rect width=\"900\" height=\"383\" fill=\"#000\" /></svg>\n```\n祝您使用愉快！";
  const result = extractCleanSvg(rawMarkdown);
  assert.ok(result, "应成功提取 SVG");
  assert.ok(result.startsWith("<svg"), "应以 <svg 开始");
  assert.ok(result.endsWith("</svg>"), "应以 </svg> 结束");
  assert.ok(result.includes('xmlns="http://www.w3.org/2000/svg"'), "应自动补齐 xmlns 命名空间");
});

test("extractCleanSvg: 空值或无有效 SVG 标签时安全返回 null", () => {
  assert.equal(extractCleanSvg(""), null);
  assert.equal(extractCleanSvg("普通文本没有 svg 标签"), null);
  assert.equal(extractCleanSvg("<svg>未闭合的标签"), null);
});

const VALID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 383" width="900" height="383" role="img" preserveAspectRatio="xMidYMid meet">
  <title>好好思考自己的内心需求</title>
  <desc>一篇关于个人成长与认知的杂志封面</desc>
  <rect x="0" y="0" width="900" height="383" fill="#0b132b" />
</svg>`;

test("validateCoverSvg: 合规 SVG 校验通过", () => {
  const res = validateCoverSvg(VALID_SVG);
  assert.equal(res.ok, true, `应有 ok=true，实际错误: ${res.errors.join("；")}`);
  assert.deepEqual(res.errors, []);
});

test("validateCoverSvg: 缺少 viewBox 被拒绝", () => {
  const bad = VALID_SVG.replace('viewBox="0 0 900 383"', "");
  const res = validateCoverSvg(bad);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("viewBox")), "应指出缺少 viewBox");
});

test("validateCoverSvg: 缺少 role=img 被拒绝", () => {
  const bad = VALID_SVG.replace('role="img"', "");
  const res = validateCoverSvg(bad);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("role")), "应指出缺少 role");
});

test("validateCoverSvg: 含 <script> 等违禁内容被拒绝", () => {
  const bad = VALID_SVG.replace("</svg>", "<script>alert(1)</script></svg>");
  const res = validateCoverSvg(bad);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("script")), "应指出包含 <script>");
});

test("validateCoverSvg: 含外链 URL 被拒绝", () => {
  const bad = VALID_SVG.replace("</svg>", '<image href="https://example.com/a.png" /></svg>');
  const res = validateCoverSvg(bad);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("外链")), "应指出包含外链 URL");
});

test("validateCoverSvg: 空内容被拒绝", () => {
  const res = validateCoverSvg("");
  assert.equal(res.ok, false);
});