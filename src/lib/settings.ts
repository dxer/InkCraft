import { timingSafeEqual } from "node:crypto";
import { getDb } from "./db";

export function getSettings(): Record<string, string> {
  const rows = getDb().prepare("SELECT key, value FROM app_settings").all() as {
    key: string;
    value: string | null;
  }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO app_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

export interface ByokConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** 单个模型的启用与类型标注。id 即远端 /models 返回的模型名，也作为调用时的 model。 */
export interface ModelItem {
  id: string;
  /** 是否被勾选到该提供商的可用池 */
  enabled: boolean;
  /** 类型标注：文本 / 嵌入 / 图片，可多选 */
  kinds: ModelKind[];
}

/** 多提供商档案：每个提供商通过勾选模型数组（而非三个文本框）来配置。 */
export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  /**
   * 勾选使用的模型数组。新结构；旧版 textModel/embeddingModel/imageModel
   * 在 getProviders() 读取时一次性迁移进这里。
   */
  models: ModelItem[];
  /** 旧版字段，仅为迁移兼容保留，读取后即不再使用 */
  textModel?: string;
  embeddingModel?: string;
  imageModel?: string;
}

/** 通道分配：每类模型指向哪个提供商 */
export type ChannelMap = {
  text?: string;
  embedding?: string;
  image?: string;
};

export type ModelKind = "text" | "embedding" | "image";

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getProviders(): ProviderConfig[] {
  const s = getSettings();
  const list = parseJson<ProviderConfig[]>(s["byok.providers"], []);
  if (!Array.isArray(list)) return [];

  // 旧版三文本框 → models[] 迁移：仅首次读取时执行一次（sentinel 固化），
  // 避免读取路径每次带写副作用。
  if (s["byok.providers_migrated"] === "1") return list;

  let migrated = false;
  const out = list.map((p) => {
    if (Array.isArray(p.models)) return p;
    const models: ModelItem[] = [];
    const push = (id: string | undefined, kind: ModelKind) => {
      const modelId = (id || "").trim();
      if (modelId) models.push({ id: modelId, enabled: true, kinds: [kind] });
    };
    push(p.textModel, "text");
    push(p.embeddingModel, "embedding");
    push(p.imageModel, "image");
    if (models.length === 0) return p;
    migrated = true;
    return { ...p, models };
  });

  if (migrated) {
    setSetting("byok.providers", JSON.stringify(out));
  }
  setSetting("byok.providers_migrated", "1");
  return out;
}

export function getChannels(): ChannelMap {
  const s = getSettings();
  return parseJson<ChannelMap>(s["byok.channels"], {});
}

/** 取某提供商在指定类型下第一个启用且标注了该类型的模型 id */
function kindModel(p: ProviderConfig, kind: ModelKind): string {
  const m = (p.models || []).find((m) => m.enabled && m.kinds.includes(kind));
  return m ? m.id : "";
}

/**
 * 解析某类模型的通道：优先取通道指向的提供商，否则回退到第一个填了该类模型的提供商。
 */
export function getModelChannel(
  kind: ModelKind,
): (ByokConfig & { name: string }) | null {
  const providers = getProviders().filter(
    (p) => p.baseUrl && p.apiKey && kindModel(p, kind),
  );
  if (providers.length === 0) return null;
  const wanted = getChannels()[kind];
  const p = providers.find((x) => x.id === wanted) || providers[0];
  return {
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    model: kindModel(p, kind),
    name: p.name,
  };
}

/**
 * 文本通道解析（全部 AI 调用的默认入口）：
 * 1. 优先读取后台多提供商档案中指定的文本通道；
 * 2. 兼容读取后台历史保存的 byok.* 键；
 * 3. 未在后台配置时返回 null（不从环境变量隐式读取，必须在后台 /settings 显式配置）。
 */
export function getByok(): ByokConfig | null {
  const ch = getModelChannel("text");
  if (ch) return { baseUrl: ch.baseUrl, apiKey: ch.apiKey, model: ch.model };

  const s = getSettings();
  const baseUrl = (s["byok.base_url"] || "").trim();
  const apiKey = (s["byok.api_key"] || "").trim();
  if (!baseUrl || !apiKey) return null;
  const model = (s["byok.model"] || "").trim() || "gpt-4o-mini";
  return { baseUrl, apiKey, model };
}

export function isAiConfigured(): boolean {
  return getByok() !== null;
}

/* —— 浏览器插件采集接口的 API Key —— */

export function getClipKey(): string | null {
  const s = getSettings();
  const key = s["api.clip_key"] || "";
  return key || null;
}

/** 插件请求鉴权：校验 X-InkCraft-Key 请求头（恒时比较，避免时序侧信道） */
export function verifyClipKey(request: Request): boolean {
  const provided = request.headers.get("x-inkcraft-key")?.trim() || "";
  const expected = getClipKey();
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
