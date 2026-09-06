import test from "node:test";
import assert from "node:assert/strict";
import { formatToWeChatHtml } from "../wechat-format";

test("formatToWeChatHtml 空输入安全返回", () => {
  assert.equal(formatToWeChatHtml(""), "");
  assert.equal(formatToWeChatHtml("   "), "");
});

test("formatToWeChatHtml 标题与段落内联样式转换", () => {
  const md = "# 核心大标题\n\n这是一段正文分析内容。\n\n## 小节标题\n\n第二段内容。";
  const html = formatToWeChatHtml(md, { theme: "emerald" });

  assert.ok(html.includes("<h1 style="), "H1 应该被注入内联样式");
  assert.ok(html.includes("border-bottom: 2px solid #07c160"), "H1 应该包含绿色底部边框");
  assert.ok(html.includes("<h2 style="), "H2 应该被注入内联样式");
  assert.ok(html.includes("border-left: 4px solid #07c160"), "H2 应该包含绿色左侧边框");
  assert.ok(html.includes("<p style="), "段落应注入内联字间距与行高样式");
  assert.ok(html.includes("line-height: 1.85"), "段落行高应优化");
});

test("formatToWeChatHtml 引用块与代码块内联样式转换", () => {
  const md = "> 这是一句引用的金句观点。\n\n```javascript\nconst a = 1;\n```";
  const html = formatToWeChatHtml(md, { theme: "ink" });

  assert.ok(html.includes("<blockquote style="), "引用块应注入内联样式");
  assert.ok(html.includes("<pre style="), "代码块应注入内联样式");
  assert.ok(html.includes("font-family: Consolas"), "代码块应指定等宽字体");
});
