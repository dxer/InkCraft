export interface ClipConfig {
  serverUrl: string;
  apiKey: string;
  /** 上次选择的目标知识库 id；为空表示默认（主）知识库 */
  kbId?: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface ClipResult {
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

export interface SavedNote {
  id: string;
  title: string | null;
  kbId?: string | null;
}

const STORAGE_KEY = "inkcraftConfig";

/** 自动去除尾部斜杠或误输入的 /api(/extension) 路径 */
export function normalizeServerUrl(url: string): string {
  if (!url) return "";
  return url.trim().replace(/\/+$/, "").replace(/\/api(\/extension)?\/?$/i, "");
}

/** 扩展环境之外（如浏览器直接打开 popup.html）优雅降级 */
function storage(): chrome.storage.StorageArea | null {
  return typeof chrome !== "undefined" && chrome.storage?.local ? chrome.storage.local : null;
}

export async function loadConfig(): Promise<ClipConfig> {
  const store = storage();
  if (!store) {
    return { serverUrl: "http://localhost:3000", apiKey: "" };
  }
  const stored = await store.get(STORAGE_KEY);
  const cfg = stored[STORAGE_KEY] as Partial<ClipConfig> | undefined;
  return {
    serverUrl: normalizeServerUrl(cfg?.serverUrl || "http://localhost:3000"),
    apiKey: (cfg?.apiKey || "").trim(),
    kbId: cfg?.kbId || "",
  };
}

export async function saveConfig(config: ClipConfig): Promise<void> {
  const store = storage();
  const normalized: ClipConfig = {
    ...config,
    serverUrl: normalizeServerUrl(config.serverUrl),
    apiKey: config.apiKey.trim(),
    kbId: config.kbId || "",
  };
  if (store) await store.set({ [STORAGE_KEY]: normalized });
}

/** 向当前活动标签页采集内容；content script 未就绪时按需注入后重试 */
export async function captureActiveTab(mode: "page" | "selection"): Promise<ClipResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("未找到活动标签页");
  }

  const send = () =>
    chrome.tabs.sendMessage(tab.id as number, { type: "INKCRAFT_EXTRACT", mode });

  let response: { ok: boolean; data: ClipResult };
  try {
    response = await send();
  } catch {
    // content script 尚未注入（扩展刚安装/刷新，或页面早于扩展打开）
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    response = await send();
  }

  if (!response?.data) {
    throw new Error("采集失败：页面无响应");
  }
  return response.data;
}

/**
 * 启动区域剪藏：向页面注入拾取模式后，popup 会自行关闭（点击页面必失焦），
 * 后续拾取、预览与保存全部由 content script 的页内面板完成。
 */
export async function startRegionPick(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("未找到活动标签页");
  }

  const send = () =>
    chrome.tabs.sendMessage(tab.id as number, { type: "INKCRAFT_PICK_REGION" });

  try {
    await send();
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    await send();
  }
}

function headers(config: ClipConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-InkCraft-Key": config.apiKey,
  };
}

/** 校验服务地址与 API Key */
export async function pingServer(config: ClipConfig): Promise<{ ok: boolean; error?: string }> {
  const base = normalizeServerUrl(config.serverUrl);
  if (!base || !config.apiKey) {
    return { ok: false, error: "请先填写服务地址与 API Key" };
  }
  try {
    const res = await fetch(`${base}/api/extension/ping`, {
      method: "GET",
      headers: headers(config),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true };
    return { ok: false, error: data?.error || `连接失败（HTTP ${res.status}）` };
  } catch {
    return { ok: false, error: "无法访问服务地址，请检查 URL 与网络" };
  }
}

/** 拉取知识库列表，供剪藏时选择保存目标 */
export async function listKnowledgeBases(
  config: ClipConfig
): Promise<{ ok: boolean; kbs?: KnowledgeBase[]; error?: string }> {
  const base = normalizeServerUrl(config.serverUrl);
  if (!base || !config.apiKey) {
    return { ok: false, error: "请先填写服务地址与 API Key" };
  }
  try {
    const res = await fetch(`${base}/api/extension/kbs`, {
      method: "GET",
      headers: headers(config),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, kbs: data?.kbs || [] };
    return { ok: false, error: data?.error || `连接失败（HTTP ${res.status}）` };
  } catch {
    return { ok: false, error: "无法访问服务地址，请检查 URL 与网络" };
  }
}

/** 保存剪藏到墨匠，返回创建的笔记 */
export async function saveClip(
  config: ClipConfig,
  result: ClipResult
): Promise<SavedNote> {
  const base = normalizeServerUrl(config.serverUrl);
  const res = await fetch(`${base}/api/extension/clip`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({
      title: result.title,
      content: result.content,
      sourceUrl: result.sourceUrl,
      mode: result.mode,
      kbId: config.kbId || "",
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `保存失败（HTTP ${res.status}）`);
  }
  return data.note as SavedNote;
}
