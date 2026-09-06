/**
 * 卡片 markdown 解析（纯函数，客户端可用；不得引入 db / 服务端模块）。
 * 从整卡 markdown 中解析六字段结构（核心洞察/认知张力/边界与约束/零件/破题切口/截图级金句）。
 * 兼容旧格式卡（主张/边界/零件/切口/原句/信度）与新格式卡。
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
} {
  // 按标题切片：title -> body
  const sections = new Map<string, string>();
  let current = "";
  let body: string[] = [];
  const flush = () => {
    if (current) sections.set(current.trim(), body.join("\n").trim());
  };
  for (const raw of md.split("\n")) {
    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      current = h[2];
      body = [];
    } else {
      body.push(raw);
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
  const afterColon = (l: string) => l.split(/[：:]/).slice(1).join(/[：:]/.test(l) ? "：" : "").trim();

  // 1. 核心洞察 / 主张
  const claimLines = lines("核心洞察", "主张", "核心主张", "一句话观点");
  const claim =
    claimLines
      .map((l) => stripBullet(l).replace(/^\（.*?\）\s*/, "").replace(/^\(.*?\)\s*/, ""))
      .find((l) => l && !l.startsWith("（") && l.length > 4) ||
    lines("一句话观点")
      .map((l) => l.replace(/^>\s*/, "").replace(/^[「"]/g, "").replace(/[」"]$/g, "").trim())
      .find((l) => l && l.length > 8) ||
    md
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^#{1,6}\s/.test(l) && l.length > 8)[0]
      ?.replace(/^>\s*/, "")
      .replace(/^[-*+]\s*/, "")
      .replace(/\*\*/g, "")
      .trim() ||
    "";

  // 2. 认知张力（对冲/误区与解法）
  const tensionLines = lines("认知张力", "张力");
  const misconception = tensionLines.map(stripBullet).find((l) => /^惯性误区|^误区|^传统/.test(l)) || "";
  const solution = tensionLines.map(stripBullet).find((l) => /^破局逻辑|^破局|^正解/.test(l)) || "";

  // 3. 边界与约束
  const boundaryLines = lines("边界与约束", "边界");
  const applicable = boundaryLines.map(stripBullet).find((l) => /^适用/.test(l)) || "";
  const notApplicable = boundaryLines.map(stripBullet).find((l) => /^反适用|^踩坑/.test(l)) || "";

  // 4. 硬核零件 / 论据
  const partLines = lines("硬核零件", "零件", "论据零件");
  const parts: { text: string; evidence: string }[] = [];
  let pending: string | null = null;
  for (const l of partLines) {
    if (/^[-*+]\s/.test(l)) {
      if (pending) parts.push({ text: pending, evidence: "" });
      pending = stripBullet(l).replace(/^(论据|隐喻|证据)[：:]\s*/, "").replace(/\*\*/g, "").trim();
    } else if (pending && /依据/.test(l)) {
      const m = l.match(/[「"'](.+?)[」"']/);
      parts.push({ text: pending, evidence: m ? m[1] : afterColon(stripBullet(l)) });
      pending = null;
    }
  }
  if (pending) parts.push({ text: pending, evidence: "" });

  // 5. 破题切口
  const cutLines = lines("破题切口", "切口", "第一刀");
  const cut = cutLines.map((l) => stripBullet(l).replace(/^(类型|第一刀|切口)[：:]\s*/, "")).join("；");

  // 6. 截图级金句 / 原句
  const quoteLines = lines("截图级金句", "核心金句", "原句");
  const quote =
    quoteLines
      .map(stripBullet)
      .find((l) => l && !/^原文未提供$/.test(l))
      ?.replace(/^[「"']|[」"']$/g, "") || "";

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
  };
}
