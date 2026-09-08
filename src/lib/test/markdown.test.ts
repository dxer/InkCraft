import { test } from "node:test";
import assert from "node:assert/strict";

import { escapeHtml, renderMarkdown } from "../markdown";

test("renderMarkdown：正常 markdown 正常渲染", () => {
  const html = renderMarkdown("# 标题\n\n**加粗** 与 `code`");
  assert.match(html, /<h1[^>]*>标题<\/h1>/);
  assert.match(html, /<strong>加粗<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
});

test("renderMarkdown：script 标签与事件属性被剥离", () => {
  const html = renderMarkdown(
    'hello <script>alert(1)</script> <img src="x" onerror="alert(1)"> [link](javascript:alert(1))',
  );
  assert.equal(html.includes("<script"), false);
  assert.equal(html.includes("onerror"), false);
  assert.equal(html.includes("javascript:"), false);
  // 合法 img 标签保留（src 属性不受影响）
  assert.match(html, /<img/);
});

test("escapeHtml：特殊字符全部转义，二次入 innerHTML 不执行", () => {
  const raw = `<img src="x" onerror='alert(1)'>&</b>`;
  const escaped = escapeHtml(raw);
  assert.equal(escaped.includes("<img"), false);
  assert.equal(
    escaped,
    "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;&lt;/b&gt;",
  );
});
