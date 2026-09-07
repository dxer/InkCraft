import { NextResponse } from "next/server";
import {
  getChannels,
  getProviders,
  getSettings,
  setSetting,
  type ChannelMap,
  type ModelItem,
  type ModelKind,
  type ProviderConfig,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

const MAX_PROVIDERS = 12;

function maskKey(apiKey: string): string {
  if (!apiKey) return "";
  return apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "••••••••";
}

/** 旧版单通道键 → 提供商档案的一次性视图合成（仅从数据库读取历史设置，不落库，保存时才迁移） */
function legacyProvider(s: Record<string, string>): ProviderConfig | null {
  const baseUrl = (s["byok.base_url"] || "").trim();
  if (!baseUrl) return null;
  const apiKey = (s["byok.api_key"] || "").trim();
  return {
    id: "legacy-default",
    name: "默认通道",
    baseUrl,
    apiKey: maskKey(apiKey),
    models: [{ id: (s["byok.model"] || "").trim() || "gpt-4o-mini", enabled: true, kinds: ["text"] }],
  };
}

export async function GET() {
  const s = getSettings();
  const stored = getProviders();
  const providers = stored.length > 0
    ? stored.map((p) => ({ ...p, apiKey: maskKey(p.apiKey) }))
    : (() => {
        const legacy = legacyProvider(s);
        return legacy ? [legacy] : [];
      })();

  const channels: ChannelMap =
    stored.length > 0 ? getChannels() : providers.length > 0 ? { text: providers[0].id } : {};

  return NextResponse.json({ providers, channels });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const incoming = Array.isArray(body.providers) ? body.providers : [];
  if (incoming.length > MAX_PROVIDERS) {
    return NextResponse.json({ error: `最多支持 ${MAX_PROVIDERS} 个提供商` }, { status: 400 });
  }

  // 掩码回传（含 "..." 或为空）时保留已存的真实密钥
  const storedById = new Map(getProviders().map((p) => [p.id, p]));
  const providers: ProviderConfig[] = incoming.map((raw: Record<string, unknown>) => {
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : crypto.randomUUID();
    const str = (v: unknown, max: number) =>
      typeof v === "string" ? v.trim().slice(0, max) : "";
    const prev = storedById.get(id);
    const apiKey = str(raw.apiKey, 200);

    // 模型数组解析：过滤无效项，去重 id，保留 enabled/kinds
    const rawModels = Array.isArray(raw.models) ? raw.models : [];
    const seen = new Set<string>();
    const models: ModelItem[] = [];
    for (const m of rawModels) {
      const modelId = typeof m?.id === "string" ? m.id.trim().slice(0, 200) : "";
      if (!modelId || seen.has(modelId)) continue;
      seen.add(modelId);
      const kinds: ModelKind[] = Array.isArray(m.kinds)
        ? (m.kinds as unknown[]).filter(
            (k): k is ModelKind => k === "text" || k === "embedding" || k === "image"
          )
        : [];
      models.push({ id: modelId, enabled: !!m.enabled, kinds });
    }
    // 兼容旧版：前端仍可能提交三文本框
    if (models.length === 0) {
      for (const [field, kind] of [
        ["textModel", "text"],
        ["embeddingModel", "embedding"],
        ["imageModel", "image"],
      ] as const) {
        const modelId = str((raw as Record<string, unknown>)[field], 120);
        if (modelId) models.push({ id: modelId, enabled: true, kinds: [kind as ModelKind] });
      }
    }

    return {
      id,
      name: str(raw.name, 40) || "未命名提供商",
      baseUrl: str(raw.baseUrl, 300),
      apiKey: apiKey && !apiKey.includes("...") ? apiKey : prev?.apiKey || "",
      models,
      // 迁移时旧的 prev 可能已是 models 结构；此处仅保留上述 fields 供读取兼容
      textModel: prev?.textModel ?? "",
      embeddingModel: prev?.embeddingModel ?? "",
      imageModel: prev?.imageModel ?? "",
    };
  });

  const incomingChannels = (body.channels || {}) as ChannelMap;
  const validIds = new Set(providers.map((p) => p.id));
  const channels: ChannelMap = {};
  for (const kind of ["text", "embedding", "image"] as const) {
    const id = incomingChannels[kind];
    if (id && validIds.has(id)) channels[kind] = id;
  }

  setSetting("byok.providers", JSON.stringify(providers));
  setSetting("byok.channels", JSON.stringify(channels));

  return NextResponse.json({
    ok: true,
    providers: providers.map((p) => ({ ...p, apiKey: maskKey(p.apiKey) })),
    channels,
  });
}
