/**
 * Markdown 感知分块：先按标题切节，节内按空行段落累积；
 * 目标块长 ~600 字，硬上限 1000 字；超长段落回退按句子切。
 */
const TARGET = 600;
const MAX = 1000;
const MERGE_BELOW = 80;

export function chunkText(raw: string): string[] {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const pieces: string[] = [];
  for (const section of splitByHeadings(text)) {
    splitSection(section, pieces);
  }
  // 过小的尾块并入前一块，避免检索噪音
  const merged: string[] = [];
  for (const p of pieces) {
    const last = merged[merged.length - 1];
    if (last !== undefined && last.length < MERGE_BELOW && last.length + p.length + 2 <= MAX) {
      merged[merged.length - 1] = `${last}\n\n${p}`;
    } else {
      merged.push(p);
    }
  }
  return merged;
}

function splitByHeadings(text: string): string[] {
  const sections: string[] = [];
  let current: string[] = [];
  for (const line of text.split("\n")) {
    if (/^#{1,6}\s/.test(line) && current.length > 0) {
      sections.push(current.join("\n").trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) sections.push(current.join("\n").trim());
  return sections.filter(Boolean);
}

function splitSection(section: string, out: string[]): void {
  if (section.length <= MAX) {
    out.push(section);
    return;
  }
  const headingMatch = section.match(/^#{1,6}[^\n]*/);
  const heading = headingMatch ? `${headingMatch[0]}\n\n` : "";
  const body = heading ? section.slice(heading.length) : section;

  let buf = "";
  const flush = () => {
    if (buf.trim()) out.push(heading + buf.trim());
    buf = "";
  };
  for (const para of body.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length > MAX) {
      flush();
      for (const piece of splitLongParagraph(p)) {
        out.push(heading + piece);
      }
      continue;
    }
    if (buf && buf.length + p.length + 2 > TARGET) flush();
    buf = buf ? `${buf}\n\n${p}` : p;
    if (buf.length >= TARGET) flush();
  }
  flush();
}

function splitLongParagraph(p: string): string[] {
  const sentences = p.split(/(?<=[。！？!?；;])/);
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (buf && buf.length + s.length > MAX) {
      out.push(buf);
      buf = "";
    }
    buf += s;
  }
  if (buf.trim()) out.push(buf);
  return out;
}
