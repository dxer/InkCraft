import test from "node:test";
import assert from "node:assert/strict";
import {
  extractFrontmatter,
  splitAndParseDistilledCards,
  parseCardFields,
} from "../card-md";

test("extractFrontmatter: 解析双引号包裹的标准 YAML Frontmatter 与 connection_hints", () => {
  const md = `---
title: "Vibe Coding 的核心杠杆不在代码生成，而在前置软件规范（Spec）的边界锁定"
tags: [VibeCoding, AI编程, 软件工程]
hook: "很多人以为 Vibe Coding 是靠直觉写代码，最后却变成了靠玄学修 Bug"
connection_hints: ["上下文窗口污染", "测试驱动开发(TDD)", "自然语言精确度"]
type: permanent
---

### 核心机制
AI 代码模型本质上是概率推断器，其生成准确度极度依赖上下文边界的收敛程度。

### 适用边界与认知误区
- **失效场景**：单文件极简脚本、一次性探索型 Demo。
- **典型误区**：误把“提示词越口语化”当成高效。

### 落地行动
在向 AI 下达代码生成指令前，先建立一份只包含「数据结构 Schema」的 Markdown 文件。`;

  const { frontmatter, body } = extractFrontmatter(md);
  assert.equal(
    frontmatter.title,
    "Vibe Coding 的核心杠杆不在代码生成，而在前置软件规范（Spec）的边界锁定"
  );
  assert.deepEqual(frontmatter.tags, ["VibeCoding", "AI编程", "软件工程"]);
  assert.equal(
    frontmatter.hook,
    "很多人以为 Vibe Coding 是靠直觉写代码，最后却变成了靠玄学修 Bug"
  );
  assert.deepEqual(frontmatter.connection_hints, [
    "上下文窗口污染",
    "测试驱动开发(TDD)",
    "自然语言精确度",
  ]);
  assert.equal(frontmatter.type, "permanent");
  assert.match(body, /### 核心机制/);
});

test("splitAndParseDistilledCards: 能够将多张标准原子卡片准确切分并提取 connection_hints", () => {
  const rawLlmOutput = `
\`\`\`markdown
---
title: "第一张卡片：输出倒逼输入"
tags: [学习法, 费曼]
hook: "读了 100 本书依然不会用？"
connection_hints: ["费曼技巧", "认知内化"]
type: permanent
---

### 核心机制
用教会别人的方式检验自己的理解程度。

### 适用边界与认知误区
- **失效场景**：常识储备极度匮乏时。
- **典型误区**：只看不练。

### 落地行动
写一篇 300 字短文讲透一个概念。

---
title: "第二张卡片：复利效应的临界点"
tags: [成长, 投资]
hook: "为什么前期的努力往往看起来毫无波澜？"
connection_hints: ["指数增长", "临界质量"]
type: permanent
---

### 核心机制
系统积累在达到临界突破点前是线性的甚至停滞的。

### 适用边界与认知误区
- **失效场景**：方向根本性错误时。
- **典型误区**：过早放弃。

### 落地行动
保持单点突破，至少坚持 6 个月。
\`\`\`
`;

  const cards = splitAndParseDistilledCards(rawLlmOutput);
  assert.equal(cards.length, 2);

  assert.equal(cards[0].frontmatter.title, "第一张卡片：输出倒逼输入");
  assert.deepEqual(cards[0].frontmatter.tags, ["学习法", "费曼"]);
  assert.equal(cards[0].frontmatter.hook, "读了 100 本书依然不会用？");
  assert.deepEqual(cards[0].frontmatter.connection_hints, ["费曼技巧", "认知内化"]);
  assert.match(cards[0].bodyMd, /教会别人/);

  assert.equal(cards[1].frontmatter.title, "第二张卡片：复利效应的临界点");
  assert.deepEqual(cards[1].frontmatter.tags, ["成长", "投资"]);
  assert.equal(cards[1].frontmatter.hook, "为什么前期的努力往往看起来毫无波澜？");
  assert.deepEqual(cards[1].frontmatter.connection_hints, ["指数增长", "临界质量"]);
  assert.match(cards[1].bodyMd, /系统积累/);
});

test("splitAndParseDistilledCards: SKIP_EMPTY_SUBSTANCE 拒止机制正确返回空数组", () => {
  const skipOutput = "SKIP_EMPTY_SUBSTANCE";
  const cards = splitAndParseDistilledCards(skipOutput);
  assert.equal(cards.length, 0);
});

test("splitAndParseDistilledCards: 无 Frontmatter 异常输出时平滑容错保底", () => {
  const plainText = "这是一段没有按照 YAML 格式输出的文本，但是包含很有价值的洞察和论据。";
  const cards = splitAndParseDistilledCards(plainText);
  assert.equal(cards.length, 1);
  assert.ok(cards[0].frontmatter.title.length > 0);
  assert.equal(cards[0].frontmatter.type, "permanent");
  assert.match(cards[0].contentMd, /---/);
});

test("parseCardFields: 对新版 YAML Frontmatter 卡片提供完美的工坊字段抽取", () => {
  const md = `---
title: "断言式标题：工具链复杂度与生产力成反比"
tags: [效率, 架构]
hook: "你的效率工具是在帮你省时间，还是在吞噬你的精力？"
connection_hints: ["边际成本", "极简主义"]
type: permanent
---

### 核心机制
过度配置工作流会导致维护成本高于工作流本身的收益。

### 适用边界与认知误区
- **失效场景**：对协同要求极高的大型企业流水线。
- **典型误区**：以为工具越多越专业。

### 落地行动
精简工具库，保留最核心的 3 个不可替代工具。`;

  const fields = parseCardFields(md);
  assert.equal(fields.claim, "断言式标题：工具链复杂度与生产力成反比");
  assert.equal(fields.cut, "你的效率工具是在帮你省时间，还是在吞噬你的精力？");
  assert.equal(fields.quote, "你的效率工具是在帮你省时间，还是在吞噬你的精力？");
  assert.match(fields.notApplicable, /大型企业流水线/);
  assert.ok(fields.parts.length > 0);
});

test("parseCardFields: 存量六维历史卡片向下完全兼容", () => {
  const legacyMd = `## 核心洞察
用最简单的原子卡片构建知识网络

## 认知张力
- 惯性误区：收集大量长文而不整理
- 破局逻辑：提炼最小行动单元

## 边界与约束
- 适用：深度思考与写作
- 反适用：单纯的事实查阅

## 硬核零件
- 论据：卢曼卡片盒记录了数万张卡片
  依据：「卡片盒不仅是笔记，更是思考的伙伴」

## 破题切口
如何摆脱囤积癖？

## 截图级金句
「没有经过加工的知识只是别人的想法」`;

  const fields = parseCardFields(legacyMd);
  assert.equal(fields.claim, "用最简单的原子卡片构建知识网络");
  assert.equal(fields.tension?.misconception, "收集大量长文而不整理");
  assert.equal(fields.tension?.solution, "提炼最小行动单元");
  assert.equal(fields.applicable, "深度思考与写作");
  assert.equal(fields.notApplicable, "单纯的事实查阅");
  assert.equal(fields.cut, "如何摆脱囤积癖？");
  assert.equal(fields.quote, "没有经过加工的知识只是别人的想法");
  assert.equal(fields.parts.length, 1);
  assert.equal(fields.parts[0].text, "卢曼卡片盒记录了数万张卡片");
  assert.equal(fields.parts[0].evidence, "卡片盒不仅是笔记，更是思考的伙伴");
});
