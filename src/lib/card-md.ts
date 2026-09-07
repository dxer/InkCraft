/**
 * 卡片 markdown 与 YAML Frontmatter 解析器（纯函数，客户端与服务端通用；不依赖外部 Node.js 专有模块）。
 *
 * 支持：
 * 1. 卢曼原子永久知识卡片协议（YAML Frontmatter: title / tags / hook / connection_hints / type + Markdown 核心机制/边界与认知误区/落地行动）
 * 2. 多卡片切分与容错解析（splitAndParseDistilledCards）
 * 3. 历史存量六维卡片与旧版卡片无损向下兼容（parseCardFields）
 */

export interface DistilledFrontmatter {
  title: string;
  tags: string[];
  hook: string;
  type?: string;
  connection_hints?: string[];
  [key: string]: unknown;
}

export interface DistilledCard {
  frontmatter: DistilledFrontmatter;
  contentMd: string; // 包含完整 --- frontmatter --- 与正文的完整 Markdown
  bodyMd: string;    // 去除 frontmatter 后的纯 Markdown 正文
}

/**
 * 轻量健壮的 YAML 解析辅助函数（解析 title / tags / hook / connection_hints / type 等基础标量与数组）
 */
function parseYamlBlock(yamlStr: string): DistilledFrontmatter {
  const lines = yamlStr.split("\n");
  const result: Record<string, unknown> = {
    title: "",
    tags: [] as string[],
    hook: "",
    type: "permanent",
    connection_hints: [] as string[],
  };

  let currentKey = "";
  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (currentKey && inList) {
      result[currentKey] = listItems;
      inList = false;
      listItems = [];
    }
  };

  const cleanVal = (v: string) => {
    let s = v.trim();
    // 移除外层成对双引号或单引号
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    return s;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // 检查列表项 "- item"
    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch && inList) {
      listItems.push(cleanVal(listMatch[1]));
      continue;
    }

    // 键值对 "key: value"
    const kvMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (kvMatch) {
      flushList();
      const key = kvMatch[1].toLowerCase().replace(/[-]/g, "_");
      const rawVal = kvMatch[2].trim();
      currentKey = key;

      if (!rawVal) {
        // 多行列表开始
        inList = true;
        listItems = [];
      } else if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
        // 内联数组 tags: [a, b, c]
        const inner = rawVal.slice(1, -1).trim();
        const items = inner
          ? inner
              .split(/[,，]/)
              .map(cleanVal)
              .filter(Boolean)
          : [];
        result[key] = items;
      } else {
        // 普通标量
        result[key] = cleanVal(rawVal);
      }
    }
  }
  flushList();

  // 格式化 tags
  let tags: string[] = [];
  if (Array.isArray(result.tags)) {
    tags = result.tags.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean);
  } else if (typeof result.tags === "string") {
    tags = (result.tags as string)
      .split(/[,，#\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  // 格式化 connection_hints
  let connection_hints: string[] = [];
  const rawHints = result.connection_hints || result.connectionhints || result.hints;
  if (Array.isArray(rawHints)) {
    connection_hints = rawHints.map((t) => cleanVal(String(t))).filter(Boolean);
  } else if (typeof rawHints === "string") {
    connection_hints = (rawHints as string)
      .split(/[,，#\s]+/)
      .map((t) => cleanVal(t))
      .filter(Boolean);
  }

  return {
    title: String(result.title || "").trim(),
    tags,
    hook: String(result.hook || "").trim(),
    type: String(result.type || "permanent").trim(),
    connection_hints,
  };
}

/**
 * 提取单个 Markdown 文本的 Frontmatter 与 正文 body
 */
export function extractFrontmatter(md: string): { frontmatter: DistilledFrontmatter; body: string } {
  const normalized = md.trim();
  if (normalized.startsWith("---")) {
    const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n?([\s\S]*)$/);
    if (match) {
      const yamlStr = match[1];
      const body = match[2].trim();
      const frontmatter = parseYamlBlock(yamlStr);
      return { frontmatter, body };
    }
  }

  // 若无标准 frontmatter 头部，根据正文推断兜底 frontmatter
  const genericHeaders = new Set([
    "核心洞察",
    "核心机制",
    "主张",
    "核心主张",
    "一句话观点",
    "认知张力",
    "边界与约束",
    "边界与认知陷阱",
    "适用边界与认知误区",
    "硬核零件",
    "破题切口",
    "截图级金句",
    "落地行动",
    "提炼知识卡片",
    "知识卡片",
    "卡片",
  ]);
  const firstHeadingMatch = normalized.match(/^#{1,6}\s+(.+)$/m);
  let title = "";
  if (firstHeadingMatch && !genericHeaders.has(firstHeadingMatch[1].trim())) {
    title = firstHeadingMatch[1].replace(/^[「"']|[」"']$/g, "").trim();
  }
  if (!title) {
    const firstLine =
      normalized
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith("#")) || "";
    title = firstLine.slice(0, 35);
  }

  return {
    frontmatter: {
      title,
      tags: [],
      hook: "",
      type: "permanent",
      connection_hints: [],
    },
    body: normalized,
  };
}

/**
 * 将 LLM 蒸馏输出（可能包含 1~3 个带 --- 头部或分割线的原子卡片）切分为独立的原子卡片数组。
 * 具备极强容错保底机制：精确锚定带有 title: 的 Frontmatter 块，绝不因正文内部的 --- 分割线发生误切分。
 */
export function splitAndParseDistilledCards(rawOutput: string): DistilledCard[] {
  if (!rawOutput || !rawOutput.trim()) return [];

  // 清洗外层代码块包裹 ```markdown ... ```
  let cleaned = rawOutput.trim();
  if (cleaned === "SKIP_EMPTY_SUBSTANCE" || cleaned.startsWith("SKIP_EMPTY_SUBSTANCE")) {
    return [];
  }

  cleaned = cleaned.replace(/^```(?:markdown|md|ya?ml)?\r?\n/i, "");
  cleaned = cleaned.replace(/\r?\n```\s*$/i, "");
  cleaned = cleaned.trim();

  if (cleaned === "SKIP_EMPTY_SUBSTANCE" || cleaned.startsWith("SKIP_EMPTY_SUBSTANCE")) {
    return [];
  }

  // 精确匹配每个以 --- 开头且包含 title: 的 Frontmatter 块及后续正文
  const cardRegex =
    /(?:^|\n)---\r?\n([\s\S]*?\btitle\s*:\s*[\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n?([\s\S]*?)(?=(?:\r?\n---\r?\n[\s\S]*?\btitle\s*:\s*)|$)/g;

  const matches = [...cleaned.matchAll(cardRegex)];
  const results: DistilledCard[] = [];

  if (matches.length > 0) {
    for (const match of matches) {
      const yamlStr = match[1];
      const body = match[2].trim();
      const frontmatter = parseYamlBlock(yamlStr);
      if (!frontmatter.title) continue;

      const yamlLines = [
        "---",
        `title: ${JSON.stringify(frontmatter.title)}`,
        `tags: [${frontmatter.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
        `hook: ${JSON.stringify(frontmatter.hook || "")}`,
      ];

      if (frontmatter.connection_hints && frontmatter.connection_hints.length > 0) {
        yamlLines.push(`connection_hints: [${frontmatter.connection_hints.map((h) => JSON.stringify(h)).join(", ")}]`);
      }

      yamlLines.push(`type: ${frontmatter.type || "permanent"}`);
      yamlLines.push("---");
      yamlLines.push("");
      yamlLines.push(body);

      results.push({
        frontmatter,
        contentMd: yamlLines.join("\n"),
        bodyMd: body,
      });
    }
  }

  // 容错降级：如果正则未匹配到带 title: 的 frontmatter 块，走单篇容错解析
  if (results.length === 0) {
    const { frontmatter, body } = extractFrontmatter(cleaned);
    if (!frontmatter.title) {
      const fallbackTitle =
        body
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith("#")) || "提炼知识卡片";
      frontmatter.title = fallbackTitle.slice(0, 35);
    }

    const yamlLines = [
      "---",
      `title: ${JSON.stringify(frontmatter.title)}`,
      `tags: [${frontmatter.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
      `hook: ${JSON.stringify(frontmatter.hook || "")}`,
    ];

    if (frontmatter.connection_hints && frontmatter.connection_hints.length > 0) {
      yamlLines.push(`connection_hints: [${frontmatter.connection_hints.map((h) => JSON.stringify(h)).join(", ")}]`);
    }

    yamlLines.push(`type: ${frontmatter.type || "permanent"}`);
    yamlLines.push("---");
    yamlLines.push("");
    yamlLines.push(body);

    results.push({
      frontmatter,
      contentMd: yamlLines.join("\n"),
      bodyMd: body,
    });
  }

  return results;
}

/**
 * 卡片字段解析器（纯函数，供工坊 Workshop、选题库 Topics、检索加分检索与卡片画廊通用）。
 * 同时完美兼容：
 * 1. 新版 YAML Frontmatter 原子卡片（title / tags / hook / connection_hints + 核心机制 / 适用边界与认知误区 / 落地行动）
 * 2. 存量六维卡片（核心洞察 / 认知张力 / 边界与约束 / 硬核零件 / 破题切口 / 截图级金句）
 * 3. 旧版十段式卡片（一句话观点 / 适用对象 / 三个支撑等）
 */
export function parseCardFields(md: string): {
  claim: string;
  applicable: string;
  notApplicable: string;
  parts: { text: string; evidence: string }[];
  cut: string;
  quote: string;
  sourceShape: string;
  tension?: { misconception: string; solution: string };
  frontmatter?: DistilledFrontmatter;
} {
  const { frontmatter, body } = extractFrontmatter(md);

  // 按 Markdown 标题切片：title -> body
  const sections = new Map<string, string>();
  let current = "";
  let sectionBody: string[] = [];
  const flush = () => {
    if (current) sections.set(current.trim(), sectionBody.join("\n").trim());
  };

  for (const raw of body.split("\n")) {
    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      current = h[2].replace(/[：:].*$/, "").trim(); // 去除标题中的冒号后附注
      sectionBody = [];
    } else {
      sectionBody.push(raw);
    }
  }
  flush();

  const lines = (...names: string[]) => {
    for (const name of names) {
      const val = sections.get(name);
      if (val) {
        return val
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
      }
    }
    return [];
  };

  const stripBullet = (l: string) => l.replace(/^[-*+]\s*/, "").trim();
  const afterColon = (l: string) => {
    const parts = l.split(/[：:]/);
    return parts.length > 1 ? parts.slice(1).join("：").trim() : l.trim();
  };

  // 1. 核心洞察 / 主张 / 断言
  const hasExplicitFrontmatter = md.trim().startsWith("---");
  let claim = hasExplicitFrontmatter ? frontmatter.title : "";
  if (!claim || claim === "提炼知识卡片") {
    const claimLines = lines("核心洞察", "核心机制", "主张", "核心主张", "一句话观点");
    claim =
      claimLines
        .map((l) => stripBullet(l).replace(/^\（.*?\）\s*/, "").replace(/^\(.*?\)\s*/, ""))
        .find((l) => l && !l.startsWith("（") && l.length > 4) ||
      lines("一句话观点")
        .map((l) => l.replace(/^>\s*/, "").replace(/^[「"]/g, "").replace(/[」"]$/g, "").trim())
        .find((l) => l && l.length > 8) ||
      frontmatter.title ||
      body
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !/^#{1,6}\s/.test(l) && l.length > 8)[0]
        ?.replace(/^>\s*/, "")
        .replace(/^[-*+]\s*/, "")
        .replace(/\*\*/g, "")
        .trim() ||
      "";
  }

  // 2. 认知张力（对冲/误区与解法）
  const tensionLines = lines("适用边界与认知误区", "认知张力", "张力", "边界与认知陷阱");
  let misconception = tensionLines.map(stripBullet).find((l) => /^典型误区|^惯性误区|^误区|^传统|^大众/.test(l)) || "";
  let solution = tensionLines.map(stripBullet).find((l) => /^破局逻辑|^破局|^正解|^正确/.test(l)) || "";

  // 3. 边界与约束
  const boundaryLines = lines("适用边界与认知误区", "边界与认知陷阱", "边界与约束", "边界");
  let applicable = boundaryLines.map(stripBullet).find((l) => /^适用|^成立条件/.test(l)) || "";
  let notApplicable = boundaryLines.map(stripBullet).find((l) => /^失效场景|^反适用|^踩坑|^失效|^误区/.test(l)) || "";

  // 如果边界与认知陷阱是一整段自然语言，则做智能提取
  if (!applicable && !notApplicable && boundaryLines.length > 0) {
    const allBoundaryText = boundaryLines.join(" ");
    notApplicable = allBoundaryText.slice(0, 50);
  }

  // 4. 硬核零件 / 论据 / 机制论点 / 落地行动
  const partLines = lines("核心机制", "落地行动", "硬核零件", "零件", "论据零件");
  const parts: { text: string; evidence: string }[] = [];
  let pending: string | null = null;

  for (const l of partLines) {
    if (/^[-*+]\s/.test(l)) {
      if (pending) parts.push({ text: pending, evidence: "" });
      pending = stripBullet(l).replace(/^(论据|隐喻|证据|行动|机制)[：:]\s*/, "").replace(/\*\*/g, "").trim();
    } else if (pending && /依据/.test(l)) {
      const m = l.match(/[「"'](.+?)[」"']/);
      parts.push({ text: pending, evidence: m ? m[1] : afterColon(stripBullet(l)) });
      pending = null;
    } else if (l.length > 8 && !l.startsWith("#")) {
      // 普通段落
      parts.push({ text: l.replace(/\*\*/g, "").trim(), evidence: "" });
    }
  }
  if (pending) parts.push({ text: pending, evidence: "" });

  // 5. 破题切口 / Hook
  let cut = frontmatter.hook || "";
  if (!cut) {
    const cutLines = lines("破题切口", "切口", "第一刀", "引子");
    cut = cutLines.map((l) => stripBullet(l).replace(/^(类型|第一刀|切口|Hook)[：:]\s*/, "")).join("；");
  }

  // 6. 截图级金句 / 原句
  let quote = frontmatter.hook || "";
  if (!quote) {
    const quoteLines = lines("截图级金句", "核心金句", "原句");
    quote =
      quoteLines
        .map(stripBullet)
        .find((l) => l && !/^原文未提供$/.test(l))
        ?.replace(/^[「"']|[」"']$/g, "") || "";
  }

  const sourceLine = lines("信度").map(stripBullet).find((l) => /^来源形态/.test(l)) || "";
  const sourceShape = afterColon(sourceLine).replace(/。\s*无法判断.*$/, "").trim();

  return {
    claim: claim.replace(/\*\*/g, "").trim(),
    applicable: afterColon(applicable),
    notApplicable: afterColon(notApplicable),
    parts,
    cut,
    quote,
    sourceShape,
    tension: misconception || solution ? {
      misconception: afterColon(misconception),
      solution: afterColon(solution),
    } : undefined,
    frontmatter,
  };
}
