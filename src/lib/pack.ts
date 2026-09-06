/**
 * 装箱：把切片原文压缩成可注入起草提示词的短形态（目标 80~150 字）。
 * 纯函数，可单测。策略：首句 + 含数字/专名/引语的句子，超长截断。
 */
export function packChunk(raw: string, maxLen = 150): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) return text;

  const sentences = text
    .split(/(?<=[。！？!?；;])/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return text.slice(0, maxLen - 1) + "…";

  const first = sentences[0];
  // 找含数字、专名标记或引语的句子作为第二句（证据密度最高）
  const withEvidence = sentences
    .slice(1)
    .find((s) => /\d|「|」|《|》|[A-Za-z]{2,}|%/.test(s));

  let out = first;
  if (withEvidence && out.length + withEvidence.length + 1 <= maxLen) {
    out += withEvidence;
  }
  if (out.length > maxLen) {
    out = out.slice(0, maxLen - 1) + "…";
  }
  return out;
}

/** 装箱字符数估算（预算条用）：每条按 min(原文长, maxLen) 计 */
export function estimatePackedChars(texts: string[], maxLen = 150): number {
  return texts.reduce((sum, t) => sum + Math.min(t.replace(/\s+/g, " ").trim().length, maxLen), 0);
}
