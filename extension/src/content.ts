import { Readability } from "@mozilla/readability";
import TurndownService from "@joplin/turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";
import { loadConfig, saveClip } from "./lib/api";
import { dropLeadingTitleHeading, markdownToHtml } from "./lib/markdown";
import { fetchFxTweet, fxTweetToMarkdown, parseStatusUrl } from "./lib/x-tweet";

/**
 * 墨匠剪藏 content script：
 * - 正文/选中采集：popup 发消息，本脚本提取并转 Markdown 后返回
 * - 区域剪藏：popup 触发后进入页内拾取模式（popup 会关闭），点选区域后
 *   在页内 Shadow DOM 面板中预览并保存
 * 注入幂等：重复注入不会重复注册监听器。
 */

/* ─────────────── Markdown 转换 ─────────────── */

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});
turndown.use(gfm);
turndown.remove(["button", "form", "input", "textarea", "select", "noscript", "video", "audio", "iframe"]);
// H1 → H2 降级：笔记标题独立存储，正文层级从 H2 起更规整（Defuddle 同款处理）
turndown.addRule("heading", {
  filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
  replacement: (content, node) => {
    const level = Number(node.nodeName.charAt(1));
    const out = Math.min(level === 1 ? 2 : level, 6);
    return `\n\n${"#".repeat(out)} ${content.replace(/\n/g, " ").trim()}\n\n`;
  },
});

/** 页面懒加载图修正：data-src → src（微信/CSDN 常见），克隆树上操作 */
function fixLazyImages(root: Element): void {
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || "";
    const lazy = img.getAttribute("data-src") || img.getAttribute("data-original") || "";
    if ((!src || src.startsWith("data:")) && lazy) {
      img.setAttribute("src", lazy);
    } else if (!src || src.startsWith("data:")) {
      // 再兜底 srcset：懒加载常只写 srcset 而占位 src
      const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
      const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
      if (first) img.setAttribute("src", first);
    }
    if (!img.getAttribute("alt")) img.setAttribute("alt", "");
  });
}

/** 剔除脚本/控件/隐藏元素：隐藏判断依据原树上每个节点的实时计算样式 */
function cleanForMarkdown(original: Element, extraSelectors: string[] = []): Element {
  const clone = original.cloneNode(true) as Element;

  clone
    .querySelectorAll(
      "script, style, link, meta, svg, iframe, button, form, input, select, textarea, video, audio, canvas"
    )
    .forEach((el) => el.remove());

  const liveAll = original.querySelectorAll("*");
  const cloneAll = clone.querySelectorAll("*");
  const hidden: Element[] = [];
  liveAll.forEach((el, i) => {
    const cs = window.getComputedStyle(el);
    if (
      cs.display === "none" ||
      cs.visibility === "hidden" ||
      el.getAttribute("aria-hidden") === "true"
    ) {
      hidden.push(cloneAll[i]);
    }
  });
  hidden.forEach((el) => el?.remove());

  for (const sel of extraSelectors) {
    try {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    } catch {
      // 非法选择器忽略
    }
  }

  fixLazyImages(clone);
  return clone;
}

/**
 * 修复 Turndown 对「图片被链接包裹」结构生成的剥裂 Markdown：
 *   [\n\n![图像](image_url)\n\n](link_url)
 * 这种结构（常见于 X 推文图片卡片）会被部分 Markdown 解析器当作空链接，
 * 导致图片丢失。这里把它还原成干净的图片语法 ![图像](image_url)。
 * 仅匹配「外层链接占满整行」的情形，避免误伤正文中排成序列的普通行内链接。
 */
function fixImageLinkWrapping(md: string): string {
  // 锚定行首的链接包裹图片：外层 [ ... ![alt](src) ... ](href) 独占一行，
  // 前后只能有空白与换行。到这里，外层 URL 里的空格是个可接受的小确幸。
  const brokenRe =
    /^\s*\[\s*(\s*!\[([^\]]*)\]\(([^)]+)\)\s*)\]\([^)]*\)\s*$/gm;
  return md.replace(
    brokenRe,
    (m, inner, alt, src) => `![${alt || "图像"}](${src.trim()})`
  );
}

function htmlToMarkdown(html: Element): string {
  // @types/turndown 参数类型偏窄，运行时接受任意 Element
  const md = turndown.turndown(html as unknown as HTMLElement);
  return fixImageLinkWrapping(md)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function firstText(root: Element, selectors: string[]): string {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    const t = el?.textContent?.trim();
    if (t) return t;
  }
  return "";
}

/* ─────────────── 内容站适配规则 ─────────────── */

interface SiteExtraction {
  title: string;
  /** DOM 路径：清洗后经 Turndown 转 Markdown */
  html?: Element;
  /** API 路径：直接给出 Markdown（如 X 帖子走 FxTwitter） */
  markdown?: string;
  byline: string | null;
}

interface SiteRule {
  match: RegExp;
  extract: (doc: Document) => SiteExtraction | null | Promise<SiteExtraction | null>;
  clean?: string[];
}

const SITE_RULES: SiteRule[] = [
  {
    // 微信公众号
    match: /(^|\.)mp\.weixin\.qq\.com$/i,
    clean: ["#js_pc_qr_code", "#js_profile_qrcode", ".rich_media_tool", "#js_tags"],
    extract: (doc) => {
      const content = doc.querySelector("#js_content");
      if (!content) return null;
      return {
        title:
          doc.querySelector("#activity-name")?.textContent?.trim() ||
          doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
          doc.title,
        html: content,
        byline: doc.querySelector("#js_name")?.textContent?.trim() || null,
      };
    },
  },
  {
    // 知乎（文章 / 回答 / 问题页）
    match: /(^|\.)zhihu\.com$/i,
    clean: [".ContentItem-actions", ".Sticky", ".Question side", ".RelatedList"],
    extract: (doc) => {
      const title =
        doc.querySelector("h1.Post-Title")?.textContent?.trim() ||
        doc.querySelector(".QuestionHeader-title")?.textContent?.trim() ||
        doc.title;
      const content =
        doc.querySelector(".Post-RichTextContainer") ||
        doc.querySelector(".QuestionAnswer-content .RichContent-inner") ||
        doc.querySelector(".AnswerCard .RichContent-inner") ||
        doc.querySelector(".RichContent-inner") ||
        doc.querySelector(".RichText");
      if (!content) return null;
      return {
        title,
        html: content,
        byline: doc.querySelector(".AuthorInfo-name")?.textContent?.trim() || null,
      };
    },
  },
  {
    // CSDN 博客
    match: /(^|\.)blog\.csdn\.net$/i,
    clean: [
      ".hide-article-box",
      "#blogColumnPayAdvert",
      ".recommend-titmod",
      "#treeSkill",
      ".hljs-button",
    ],
    extract: (doc) => {
      const content = doc.querySelector("#content_views");
      if (!content) return null;
      return {
        title:
          doc.querySelector("h1.title-article")?.textContent?.trim() ||
          doc.querySelector("h1")?.textContent?.trim() ||
          doc.title,
        html: content,
        byline: doc.querySelector(".nick-name")?.textContent?.trim() || null,
      };
    },
  },
  {
    // X / Twitter：X Article 长文页 → FxTwitter API → DOM 兜底
    match: /(^|\.)(x|twitter)\.com$/i,
    extract: async (doc) => {
      const article = extractXArticle(doc);
      if (article) return article;

      // permalink 页优先走 FxTwitter：真实链接（非 t.co）+ 长帖全文 + 原图
      const status = parseStatusUrl(location.href);
      if (status) {
        const tweet = await fetchFxTweet(status.user, status.id);
        if (tweet) {
          const md = fxTweetToMarkdown(tweet);
          if (md.content.length >= 20) {
            return { title: md.title, markdown: md.content, byline: md.byline };
          }
        }
      }

      return extractTweetDom(doc);
    },
  },
];

/* ── X 站点的三级提取实现 ── */

/** Draft.js 块级类 → 语义标签（X Article 的标题/引用块靠类名区分） */
const DRAFT_BLOCK_TAGS: Record<string, string> = {
  "public-DraftStyleDefault-header-one": "h1",
  "public-DraftStyleDefault-header-two": "h2",
  "public-DraftStyleDefault-header-three": "h3",
  "public-DraftStyleDefault-header-four": "h4",
  "public-DraftStyleDefault-header-five": "h5",
  "public-DraftStyleDefault-header-six": "h6",
  "public-DraftStyleDefault-blockquote": "blockquote",
};

/**
 * X Article（专栏长文，Draft.js 富文本渲染）。
 * 关键：段落是无语义的 div、粗体是 style span，不做显式转换的话
 * Turndown 会把正文当纯文本输出——格式和链接全丢。
 * 选择器参考 Defuddle 的 x-article 提取器。
 */
function extractXArticle(doc: Document): SiteExtraction | null {
  const view = doc.querySelector('[data-testid="twitterArticleReadView"]');
  const body = view?.querySelector('[data-testid="twitterArticleRichTextView"]');
  if (!view || !body || !body.textContent?.trim()) return null;

  const clone = body.cloneNode(true) as Element;

  // 内嵌推文 → blockquote（作者 + 正文）
  clone.querySelectorAll('[data-testid="simpleTweet"]').forEach((el) => {
    const bq = doc.createElement("blockquote");
    const author = el.querySelector('[data-testid="User-Name"]')?.textContent?.trim();
    const text = el.querySelector('[data-testid="tweetText"]')?.textContent?.trim();
    if (author) {
      const p = doc.createElement("p");
      p.textContent = author;
      bq.appendChild(p);
    }
    if (text) {
      const p = doc.createElement("p");
      p.textContent = text;
      bq.appendChild(p);
    }
    el.replaceWith(bq);
  });

  // 代码块 → pre>code，语言从 language-xxx 类或 data-lang 属性取
  clone.querySelectorAll('[data-testid="markdown-code-block"]').forEach((el) => {
    const lang =
      [...el.classList]
        .find((c) => c.startsWith("language-"))
        ?.slice("language-".length) || el.getAttribute("data-lang") || "";
    const code = doc.createElement("code");
    code.textContent = el.textContent || "";
    if (lang) code.className = `language-${lang}`;
    const pre = doc.createElement("pre");
    pre.appendChild(code);
    el.replaceWith(pre);
  });

  // 链接包裹的图片 → 解包成裸 img（避免生成破损的图片-链接嵌套 Markdown）
  clone.querySelectorAll("a").forEach((a) => {
    const img = a.querySelector("img");
    if (img) a.replaceWith(img);
  });

  // 行内加粗（style 而非 strong 标签）→ strong
  clone
    .querySelectorAll('span[style*="font-weight: bold"], span[style*="font-weight:bold"]')
    .forEach((span) => {
      const strong = doc.createElement("strong");
      while (span.firstChild) strong.appendChild(span.firstChild);
      span.replaceWith(strong);
    });

  // Draft.js 块级 div → 语义标签，移动子节点保留 a/strong/code/img
  clone
    .querySelectorAll("div.public-DraftStyleDefault-block, div.longform-unstyled")
    .forEach((div) => {
      const cls = Object.keys(DRAFT_BLOCK_TAGS).find((c) => div.classList.contains(c));
      const el = doc.createElement(cls ? DRAFT_BLOCK_TAGS[cls] : "p");
      while (div.firstChild) el.appendChild(div.firstChild);
      div.replaceWith(el);
    });

  // 图片升清：pbs.twimg.com 的 name= 参数改为 large
  clone.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || "";
    if (src.startsWith("https://pbs.twimg.com/media/")) {
      img.setAttribute("src", src.replace(/([?&])name=[^&]+/, "$1name=large"));
    }
    if (!img.getAttribute("alt")) img.setAttribute("alt", "");
  });

  const title =
    view.querySelector('[data-testid="twitter-article-title"]')?.textContent?.trim() || "";
  const authorEl = view.querySelector('[itemprop="author"]');
  const name = authorEl
    ?.querySelector('meta[itemprop="name"]')
    ?.getAttribute("content")
    ?.trim();
  const handle = authorEl
    ?.querySelector('meta[itemprop="additionalName"]')
    ?.getAttribute("content")
    ?.trim();
  const byline = name && handle ? `${name}（@${handle}）` : name || handle || null;

  return { title: title || "X 长文", html: clone, byline };
}

/** DOM 兜底：API 不可用时直接抓首帖 tweetText（链接会是 t.co 短链，降级可接受） */
function extractTweetDom(doc: Document): SiteExtraction | null {
  const article = doc.querySelector('article[data-testid="tweet"]');
  if (!article) return null;
  const texts = Array.from(article.querySelectorAll('[data-testid="tweetText"]'));
  if (texts.length === 0) return null;
  const wrapper = doc.createElement("div");
  texts.forEach((t, i) => {
    if (i > 0) {
      wrapper.appendChild(doc.createElement("br"));
      wrapper.appendChild(doc.createElement("br"));
    }
    wrapper.appendChild(t.cloneNode(true));
  });
  const user =
    article.querySelector('a[href^="/"] span')?.textContent?.trim() ||
    doc.querySelector('[data-testid="UserName"] span')?.textContent?.trim() ||
    null;
  // 标题优先级：og:title → document.title 抽取 on X: "…" → 正文首行
  const ogTitle =
    doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
  const docTitle = doc.title || "";
  let title = ogTitle.trim() || "";
  if (!title) {
    const m = docTitle.match(/on X:?\s*"?([^"]+)"?/i);
    if (m) title = m[1].trim();
    else
      title = docTitle
        .replace(/\s*\/\s*(X|状态|status).*$/i, "")
        .replace(/\s*on X\b.*$/i, "")
        .trim();
  }
  if (!title) {
    const firstLine = texts[0]?.textContent?.trim()?.split("\n")[0]?.trim() || "";
    title = firstLine.length > 3 ? firstLine : "X 帖子";
  }
  return { title, html: wrapper, byline: user };
}

async function applySiteRule(): Promise<{ hit: SiteExtraction; clean?: string[] } | null> {
  const rule = SITE_RULES.find((r) => r.match.test(location.hostname));
  if (!rule) return null;
  try {
    const hit = await rule.extract(document);
    if (!hit) return null;
    if (hit.markdown) {
      if (!hit.markdown.trim()) return null;
    } else if (!hit.html?.textContent?.trim()) {
      return null;
    }
    return { hit, clean: rule.clean };
  } catch {
    return null;
  }
}

/* ─────────────── 正文 / 选中 采集 ─────────────── */

export interface ExtractResult {
  ok: boolean;
  mode: "page" | "selection" | "region";
  title: string;
  content: string;
  excerpt: string;
  byline: string | null;
  sourceUrl: string;
  wordCount: number;
  error?: string;
}

function clampTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 80);
}

function normalizeText(raw: string): string {
  return raw.replace(/\n{3,}/g, "\n\n").trim();
}

async function extractPage(): Promise<ExtractResult> {
  const sourceUrl = location.href;

  // 1. 站点专属规则（X 等站点含 API 异步抓取）
  const site = await applySiteRule();
  if (site) {
    const content = site.hit.markdown
      ? site.hit.markdown
      : htmlToMarkdown(cleanForMarkdown(site.hit.html as Element, site.clean));
    if (content.length >= 20) {
      const body = dropLeadingTitleHeading(content, site.hit.title);
      return {
        ok: true,
        mode: "page",
        title: clampTitle(site.hit.title),
        content: body,
        excerpt: body.slice(0, 120),
        byline: site.hit.byline,
        sourceUrl,
        wordCount: body.length,
      };
    }
  }

  // 2. Readability 通用兜底
  const clone = document.cloneNode(true) as Document;
  const article = new Readability(clone).parse();
  const raw = article?.content
    ? htmlToMarkdown(cleanForMarkdown((() => {
        const wrap = document.createElement("div");
        wrap.innerHTML = article.content;
        return wrap;
      })()))
    : "";
  const content = article ? dropLeadingTitleHeading(raw, article.title || "") : raw;
  if (!content || content.length < 20) {
    return {
      ok: false,
      mode: "page",
      title: document.title || "",
      content: "",
      excerpt: "",
      byline: null,
      sourceUrl,
      wordCount: 0,
      error: "未能提取到有效正文，该页面可能是登录页、空页或纯交互应用。",
    };
  }

  return {
    ok: true,
    mode: "page",
    title: clampTitle(article?.title || document.title || "网页剪藏"),
    content,
    excerpt: normalizeText(article?.excerpt || content.slice(0, 120)),
    byline: article?.byline || null,
    sourceUrl,
    wordCount: content.length,
  };
}

function extractSelection(): ExtractResult {
  const sourceUrl = location.href;
  const selection = window.getSelection();

  // 取选中区域的 DOM 结构（保留标题/列表/引用等），转成 Markdown
  let markdown = "";
  let viaTextFallback = false;
  const range =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (range && !range.collapsed) {
    try {
      const wrap = document.createElement("div");
      wrap.appendChild(range.cloneContents().cloneNode(true));
      const cleaned = cleanForMarkdown(wrap);
      markdown = htmlToMarkdown(cleaned);
    } catch {
      markdown = "";
    }
  }
  if (!markdown) {
    markdown = normalizeText(selection?.toString() || "");
    viaTextFallback = true;
  }

  if (!markdown) {
    return {
      ok: false,
      mode: "selection",
      title: "",
      content: "",
      excerpt: "",
      byline: null,
      sourceUrl,
      wordCount: 0,
      error: "当前页面没有选中的内容，请先在页面上选中一段文字。",
    };
  }
  return {
    ok: true,
    mode: "selection",
    title: clampTitle(`${document.title || "网页选中摘录"}${viaTextFallback ? "" : " · 摘录"}`),
    content: markdown,
    excerpt: normalizeText(markdown.slice(0, 120)),
    byline: null,
    sourceUrl,
    wordCount: markdown.length,
  };
}

/* ─────────────── 区域剪藏：拾取 + 页内保存面板 ─────────────── */

const PICK_STYLE_ID = "inkcraft-pick-style";

let pickActive = false;

function ensurePickStyle(): void {
  if (document.getElementById(PICK_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PICK_STYLE_ID;
  style.textContent = `
    .inkcraft-pick-outline {
      position: absolute; z-index: 2147483645; pointer-events: none;
      outline: 2px solid #171717; outline-offset: -1px;
      background: rgba(23, 23, 23, 0.06);
      border-radius: 2px; transition: all 0.04s linear;
    }
    .inkcraft-pick-tip {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 2147483646; pointer-events: none;
      background: #171717; color: #fafafa;
      font: 500 12px/1 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      padding: 8px 14px; border-radius: 999px;
    }
  `;
  document.documentElement.appendChild(style);
}

function logicalBlock(el: Element): Element {
  // 沿父链收敛到「内容更多的最小块」：父节点文本内容与当前完全一致时上移
  let cur: Element = el;
  for (let i = 0; i < 6; i++) {
    const parent = cur.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) break;
    const a = (cur.textContent || "").trim();
    const b = (parent.textContent || "").trim();
    if (a && b && a === b) cur = parent;
    else break;
  }
  return cur;
}

function startRegionPick(): void {
  if (pickActive) return;
  pickActive = true;
  ensurePickStyle();

  const outline = document.createElement("div");
  outline.className = "inkcraft-pick-outline";
  const tip = document.createElement("div");
  tip.className = "inkcraft-pick-tip";
  tip.textContent = "点击要剪藏的页面区域 · 按 Esc 取消";
  document.documentElement.append(outline, tip);

  let current: Element | null = null;

  function position(el: Element): void {
    const r = el.getBoundingClientRect();
    outline.style.left = `${r.left + scrollX - 2}px`;
    outline.style.top = `${r.top + scrollY - 2}px`;
    outline.style.width = `${r.width + 4}px`;
    outline.style.height = `${r.height + 4}px`;
  }

  function onMove(e: MouseEvent): void {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === outline || el === tip) return;
    current = logicalBlock(el);
    position(current);
  }

  function finish(): void {
    pickActive = false;
    outline.remove();
    tip.remove();
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") finish();
  }

  function onClick(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const el = current || document.elementFromPoint(e.clientX, e.clientY);
    finish();
    if (el) openRegionPanel(logicalBlock(el));
  }

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);
}

/* ── 页内保存面板（Shadow DOM 隔离样式） ── */

let panelHost: HTMLDivElement | null = null;

function closeRegionPanel(): void {
  panelHost?.remove();
  panelHost = null;
}

function openRegionPanel(el: Element): void {
  closeRegionPanel();

  const cleaned = cleanForMarkdown(el);
  const markdown = htmlToMarkdown(cleaned);
  if (markdown.length < 10) return;

  const heading = cleaned.querySelector("h1, h2, h3");
  const title = clampTitle(
    heading?.textContent?.trim() ||
      el.querySelector("h1, h2, h3")?.textContent?.trim() ||
      document.title ||
      "区域剪藏"
  );

  panelHost = document.createElement("div");
  panelHost.style.cssText = "all:initial; position: fixed; z-index: 2147483647;";
  const shadow = panelHost.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .panel {
        position: fixed; top: 16px; right: 16px; width: 340px;
        background: #ffffff; color: #171717;
        border: 1px solid #e5e5e5; border-radius: 12px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.18);
        font: 13px/1.6 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
        padding: 14px; box-sizing: border-box;
      }
      .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .brand { font-weight: 600; font-size: 13px; }
      .close { border: none; background: none; cursor: pointer; color: #737373; font-size: 16px; padding: 2px 6px; border-radius: 6px; }
      .close:hover { background: #f0f0f0; color: #171717; }
      input[type="text"], textarea {
        width: 100%; box-sizing: border-box; border: 1px solid #e5e5e5; border-radius: 8px;
        font: inherit; color: inherit; outline: none; background: #fafafa; padding: 7px 9px;
      }
      input[type="text"] { font-weight: 600; margin-bottom: 8px; }
      input[type="text"]:focus, textarea:focus { border-color: #171717; }
      textarea { min-height: 160px; max-height: 300px; resize: vertical; font-size: 12px; line-height: 1.7; }
      .tabs { display: flex; align-items: center; gap: 2px; margin-bottom: 8px; }
      .tabs .t { padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; color: #737373; cursor: pointer; border: none; background: none; }
      .tabs .t.active { background: #f0f0f0; color: #171717; }
      .tabs .thint { margin-left: auto; font-size: 10px; color: #a3a3a3; }
      .rendered {
        min-height: 200px; max-height: 300px; overflow-y: auto; padding: 10px 12px;
        border: 1px solid #f0f0f0; border-radius: 8px; background: #fafafa;
        font-size: 12px; line-height: 1.7; display: none;
      }
      .rendered.show { display: block; }
      .rendered > *:first-child { margin-top: 0; }
      .rendered > *:last-child { margin-bottom: 0; }
      .rendered h1,.rendered h2,.rendered h3 { font-weight: 700; margin: 10px 0 6px; color: #111; }
      .rendered h1 { font-size: 16px; } .rendered h2 { font-size: 14px; } .rendered h3 { font-size: 13px; }
      .rendered p { margin: 6px 0; }
      .rendered a { color: #155eef; text-decoration: none; }
      .rendered ul,.rendered ol { margin: 6px 0; padding-left: 20px; }
      .rendered ul { list-style: disc; } .rendered ol { list-style: decimal; }
      .rendered blockquote { margin: 8px 0; padding: 6px 12px; border-left: 3px solid #d4d4d4; background: #f5f5f5; color: #525252; }
      .rendered code { padding: 1px 5px; border-radius: 4px; background: #eee; color: #b45309; font-family: ui-monospace, Menlo, monospace; font-size: 0.92em; }
      .rendered pre { margin: 8px 0; padding: 10px 12px; border-radius: 8px; background: #171717; color: #fafafa; overflow-x: auto; }
      .rendered pre code { padding: 0; background: none; color: inherit; }
      .rendered table { width: 100%; margin: 8px 0; border-collapse: collapse; font-size: 11.5px; }
      .rendered th,.rendered td { padding: 6px 8px; border: 1px solid #e5e5e5; text-align: left; }
      .rendered th { background: #f0f0f0; font-weight: 600; }
      .rendered img { display: none; }
      .meta { display: flex; justify-content: space-between; font-size: 10px; color: #a3a3a3; margin: 6px 0 10px; }
      .row { display: flex; gap: 8px; }
      button {
        flex: 1; height: 32px; border: none; border-radius: 8px; cursor: pointer;
        font: 600 12px inherit; transition: opacity 0.15s;
      }
      .save { background: #171717; color: #fafafa; }
      .cancel { background: #f0f0f0; color: #171717; }
      button:disabled { opacity: 0.45; cursor: not-allowed; }
      .status { margin-top: 8px; font-size: 11px; line-height: 1.6; display: none; }
      .status.ok { display: block; color: #047857; }
      .status.err { display: block; color: #b91c1c; }
      .status.info { display: block; color: #525252; }
      a { color: inherit; font-weight: 600; }
    </style>
    <div class="panel">
      <div class="head">
        <span class="brand">墨匠 · 区域剪藏</span>
        <button class="close" data-act="close" title="关闭">✕</button>
      </div>
      <input type="text" data-el="title" value="" placeholder="标题" />
      <div class="tabs">
        <button class="t active" data-view="preview">预览</button>
        <button class="t" data-view="source">Markdown</button>
        <span class="thint">排版预览</span>
      </div>
      <textarea data-el="content" spellcheck="false" style="display:none"></textarea>
      <div class="rendered show" data-el="rendered"></div>
      <div class="meta">
        <span>${location.hostname}</span>
        <span data-el="count"></span>
      </div>
      <div class="row">
        <button class="cancel" data-act="cancel">取消</button>
        <button class="save" data-act="save">保存到墨匠</button>
      </div>
      <div class="status" data-el="status"></div>
    </div>
  `;

  const $ = <T extends HTMLElement>(sel: string) => shadow.querySelector(sel) as T;
  const titleInput = $<HTMLInputElement>('[data-el="title"]');
  const contentBox = $<HTMLTextAreaElement>('[data-el="content"]');
  const rendered = $<HTMLElement>('[data-el="rendered"]');
  const count = $<HTMLElement>('[data-el="count"]');
  const status = $<HTMLDivElement>('[data-el="status"]');
  const saveBtn = $<HTMLButtonElement>('[data-act="save"]');

  titleInput.value = title;
  contentBox.value = markdown;
  rendered.innerHTML = markdownToHtml(markdown);
  const syncCount = () => (count.textContent = `${contentBox.value.length} 字`);
  syncCount();

  const tabs = shadow.querySelectorAll('[data-view]');
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      const isPreview = tab.getAttribute("data-view") === "preview";
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      contentBox.style.display = isPreview ? "none" : "block";
      rendered.classList.toggle("show", isPreview);
      const hint = shadow.querySelector(".thint");
      if (hint) hint.textContent = isPreview ? "排版预览" : "源码编辑";
      if (isPreview) rendered.innerHTML = markdownToHtml(contentBox.value);
    })
  );

  contentBox.addEventListener("input", () => {
    syncCount();
    rendered.innerHTML = markdownToHtml(contentBox.value);
  });

  function show(kind: "ok" | "err" | "info", html: string): void {
    status.className = `status ${kind}`;
    status.innerHTML = html;
  }

  shadow.addEventListener("click", async (e) => {
    const act = (e.target as HTMLElement)?.getAttribute?.("data-act");
    if (!act) return;
    if (act === "close" || act === "cancel") {
      closeRegionPanel();
      return;
    }
    if (act === "save") {
      const content = contentBox.value.trim();
      if (!content) return;
      saveBtn.disabled = true;
      show("info", "保存中...");
      try {
        const config = await loadConfig();
        if (!config.apiKey) {
          show("err", "尚未配置 API Key，请打开插件弹窗完成配置后重试。");
          saveBtn.disabled = false;
          return;
        }
        const note = await saveClip(config, {
          ok: true,
          mode: "region",
          title: titleInput.value.trim() || "区域剪藏",
          content,
          excerpt: content.slice(0, 120),
          byline: null,
          sourceUrl: location.href,
          wordCount: content.length,
        });
        show("ok", `✓ 已保存「${note.title || "未命名笔记"}」· <a href="${config.serverUrl}/knowledge/default?note=${note.id}" target="_blank">在墨匠中查看</a>`);
        saveBtn.textContent = "已保存";
        setTimeout(closeRegionPanel, 6000);
      } catch (err) {
        show("err", err instanceof Error ? err.message : "保存失败");
        saveBtn.disabled = false;
      }
    }
  });

  document.documentElement.appendChild(panelHost);
}

/* ─────────────── 消息入口 ─────────────── */

declare global {
  interface Window {
    __inkcraftClipperLoaded?: boolean;
  }
}

if (!window.__inkcraftClipperLoaded) {
  window.__inkcraftClipperLoaded = true;
  chrome.runtime.onMessage.addListener(
    (
      msg: { type?: string; mode?: "page" | "selection" },
      _sender,
      sendResponse
    ) => {
      if (msg?.type === "INKCRAFT_EXTRACT") {
        // X 站点走 FxTwitter API，提取是异步的；return true 保持响应通道开放
        (async () => {
          try {
            const data =
              msg.mode === "selection" ? extractSelection() : await extractPage();
            sendResponse({ ok: true, data });
          } catch (err) {
            sendResponse({
              ok: false,
              data: {
                ok: false,
                mode: "page",
                title: "",
                content: "",
                excerpt: "",
                byline: null,
                sourceUrl: location.href,
                wordCount: 0,
                error: err instanceof Error ? err.message : String(err),
              },
            });
          }
        })();
        return true;
      }

      if (msg?.type === "INKCRAFT_PICK_REGION") {
        startRegionPick();
        sendResponse({ ok: true, started: true });
        return;
      }
    }
  );
}
