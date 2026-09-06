/**
 * X / Twitter 帖子抓取：优先走 FxTwitter 公开 API（MIT 开源，可自托管），
 * 相比 DOM 抓取的三个关键优势（均已实测验证）：
 * - text 内链接是展开后的真实 URL（DOM 里是 t.co 短链）
 * - 长帖（note_tweet，is_note_tweet=true）返回全文（DOM 只渲染截断预览）
 * - 图片为原始质量（pbs.twimg.com/...?name=orig）
 * API 发送 Access-Control-Allow-Origin: *，content script 可直接 fetch。
 */

/** 从 URL 解析出 (用户名, 帖子 id)，仅匹配帖子 permalink */
export function parseStatusUrl(url: string): { user: string; id: string } | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)(x|twitter)\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d+)/);
    if (!m) return null;
    return { user: m[1], id: m[2] };
  } catch {
    return null;
  }
}

/* ── FxTwitter 响应中用到的字段子集（宽松类型，按需收窄） ── */

interface FxAuthor {
  name?: string;
  screen_name?: string;
}

interface FxPhoto {
  url?: string;
  alt_text?: string | null;
}

interface FxVideo {
  url?: string;
}

interface FxMedia {
  photos?: FxPhoto[] | null;
  videos?: FxVideo[] | null;
  external?: { url?: string } | null;
}

export interface FxTweet {
  url?: string;
  text?: string;
  author?: FxAuthor;
  media?: FxMedia | null;
  quote?: FxTweet | null;
  is_note_tweet?: boolean;
  created_at?: string;
}

interface FxResponse {
  code?: number;
  tweet?: FxTweet | null;
}

/**
 * 内存缓存：同一帖在会话内只打一次 API（帖内容几乎不变），
 * 避免用户反复剪藏同一帖时重复请求触发限流。suspended 态 404 不缓存，下次重试。
 */
const fxCache = new Map<string, { tweet: FxTweet; ts: number }>();
const FX_CACHE_TTL = 5 * 60 * 1000; // 5 分钟，容忍作者编辑

/** 拉取帖子 JSON；任何失败（网络/限流/删除/超时）返回 null，由调用方回落 DOM 抓取 */
export async function fetchFxTweet(
  user: string,
  id: string,
  timeoutMs = 8000
): Promise<FxTweet | null> {
  const key = `${user}/${id}`;
  const hit = fxCache.get(key);
  if (hit && Date.now() - hit.ts < FX_CACHE_TTL) {
    return hit.tweet;
  }
  fxCache.delete(key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.fxtwitter.com/${user}/status/${id}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as FxResponse;
    if (data?.code !== 200 || !data.tweet) return null;
    fxCache.set(key, { tweet: data.tweet, ts: Date.now() });
    return data.tweet;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 引用帖 → blockquote（作者 + 正文 + 原帖链接） */
function quoteToBlockquote(quote: FxTweet): string {
  const lines: string[] = [];
  const name = quote.author?.name?.trim();
  const handle = quote.author?.screen_name?.trim();
  if (name || handle) lines.push(`**${name || ""}${handle ? `（@${handle}）` : ""}**：`);
  const text = (quote.text || "").trim();
  if (text) lines.push(...text.split("\n"));
  const url = quote.url?.trim();
  if (url) lines.push("", `[查看引用原帖](${url})`);
  return lines.map((l) => `> ${l}`.trimEnd()).join("\n");
}

export interface TweetMarkdown {
  title: string;
  content: string;
  byline: string | null;
}

/** 帖子 JSON → Markdown（纯函数，便于用真实响应做单测） */
export function fxTweetToMarkdown(tweet: FxTweet): TweetMarkdown {
  const parts: string[] = [];
  const text = (tweet.text || "").trim();
  if (text) parts.push(text);

  const photos = tweet.media?.photos || [];
  for (const p of photos) {
    if (!p.url) continue;
    parts.push(`\n\n![${(p.alt_text || "").trim() || "图片"}](${p.url})`);
  }
  const videos = tweet.media?.videos || [];
  for (const v of videos) {
    if (!v.url) continue;
    parts.push(`\n\n[▶ 视频链接](${v.url})`);
  }
  const external = tweet.media?.external?.url;
  if (external) parts.push(`\n\n[📎 外部媒体](${external})`);

  if (tweet.quote) {
    const bq = quoteToBlockquote(tweet.quote);
    if (bq) parts.push(`\n\n${bq}`);
  }

  const content = parts.join("").replace(/\n{3,}/g, "\n\n").trim();

  // 标题取正文首个非空行（长帖的惯例是首行为题）
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) || "";
  const title = firstLine.length > 3 ? firstLine : "X 帖子";

  const name = tweet.author?.name?.trim();
  const handle = tweet.author?.screen_name?.trim();
  const byline = name && handle ? `${name}（@${handle}）` : name || handle || null;

  return { title, content, byline };
}
