"use client";

import {
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Database,
  DatabaseBackup,
  Download,
  FileDown,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  MessageSquareText,
  Play,
  Plus,
  Puzzle,
  Radio,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  Volume2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { VoiceProfile } from "@/app/api/voices/route";

type TabId = "models" | "voices" | "extension" | "export";

const TABS: { id: TabId; label: string; icon: typeof KeyRound }[] = [
  { id: "models", label: "模型设置", icon: KeyRound },
  { id: "voices", label: "文风语调档案", icon: Volume2 },
  { id: "extension", label: "采集接口", icon: Puzzle },
  { id: "export", label: "数据导出与备份", icon: DatabaseBackup },
];

type ModelKind = "text" | "embedding" | "image";

interface ModelDraft {
  id: string;
  enabled: boolean;
  kinds: ModelKind[];
}

interface ProviderDraft {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: ModelDraft[];
}

const MODEL_KINDS: { kind: ModelKind; label: string; className: string }[] = [
  { kind: "text", label: "文本", className: "text-foreground" },
  { kind: "embedding", label: "嵌入", className: "text-primary" },
  { kind: "image", label: "图片", className: "text-amber-600" },
];

interface ChannelDraft {
  text?: string;
  embedding?: string;
  image?: string;
}

const PROVIDER_PRESETS = [
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    textModel: "deepseek-chat",
  },
  {
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    textModel: "glm-4-flash",
  },
  {
    name: "Kimi (Moonshot)",
    baseUrl: "https://api.moonshot.cn/v1",
    textModel: "moonshot-v1-8k",
  },
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    textModel: "gpt-4o-mini",
  },
  {
    name: "本地 Ollama",
    baseUrl: "http://localhost:11434/v1",
    textModel: "qwen2.5:7b",
  },
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    textModel: "anthropic/claude-3.5-sonnet",
  },
];

function newProvider(): ProviderDraft {
  return {
    id: crypto.randomUUID(),
    name: "新提供商",
    baseUrl: "",
    apiKey: "",
    models: [],
  };
}

/** 归一化：兼容后端返回的旧三文本框结构 → models[] */
function normalizeModels(p: {
  models?: ModelDraft[];
  textModel?: string;
  embeddingModel?: string;
  imageModel?: string;
}): ModelDraft[] {
  if (Array.isArray(p.models) && p.models.length > 0) return p.models;
  const out: ModelDraft[] = [];
  const push = (id: string | undefined, kind: ModelKind) => {
    const modelId = (id || "").trim();
    if (modelId && !out.some((m) => m.id === modelId)) {
      out.push({ id: modelId, enabled: true, kinds: [kind] });
    }
  };
  push(p.textModel, "text");
  push(p.embeddingModel, "embedding");
  push(p.imageModel, "image");
  return out;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>("models");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-8 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Settings className="size-5 text-muted-foreground" />
          系统设置
          <span className="text-sm font-normal text-muted-foreground">
            Settings
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          多提供商模型接入、文风语调档案与数据主权配置，本地优先，所有数据仅保存在本机
          SQLite。
        </p>
      </header>

      {/* 标签页切换 */}
      <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "bg-background text-foreground shadow-xs border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "models" && <ModelsTab />}
      {tab === "voices" && <VoicesTab />}
      {tab === "extension" && <ExtensionTab />}
      {tab === "export" && <ExportTab />}
    </div>
  );
}

/* ============ 标签页一：模型设置（多提供商 × 文本/嵌入/图片） ============ */

function ModelsTab() {
  const [providers, setProviders] = useState<ProviderDraft[]>([]);
  const [channels, setChannels] = useState<ChannelDraft>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channelsSaving, setChannelsSaving] = useState(false);
  const [channelsSaved, setChannelsSaved] = useState(false);

  // 每个提供商独立的连通性测试状态
  const [testState, setTestState] = useState<
    Record<
      string,
      { testing: boolean; ok?: boolean; error?: string; latencyMs?: number }
    >
  >({});

  // 每个提供商待手填的新模型名
  const [addModelInput, setAddModelInput] = useState<Record<string, string>>(
    {},
  );

  // 「拉取模型列表」弹框：拉取全部模型后在弹框里勾选并标注类型，确认后只保留选中的
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<string>("");
  const [pickerName, setPickerName] = useState("");
  const [pickerAll, setPickerAll] = useState<string[]>([]);
  // 弹框内的勾选草稿：modelId → 已标注的类型（存在即视为勾选）
  const [pickerKinds, setPickerKinds] = useState<Record<string, ModelKind[]>>(
    {},
  );
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  // 提供商配置弹框：当前正在编辑（或新建）的 provider id；null 表示弹框关闭
  const [editProviderId, setEditProviderId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.providers) {
          setProviders(
            data.providers.map((p: ProviderDraft) => ({
              ...p,
              models: normalizeModels(p),
            })),
          );
        }
        if (data?.channels) setChannels(data.channels);
      })
      .finally(() => setLoading(false));
  }, []);

  function updateProvider(id: string, patch: Partial<ProviderDraft>) {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  function addProvider() {
    const fresh = newProvider();
    setProviders((prev) => [...prev, fresh]);
    setEditProviderId(fresh.id);
  }

  /** 关闭配置弹框；若新建的是空 provider（未填任何信息）则一并移除 */
  function closeProviderEditor() {
    if (editProviderId) {
      const p = providers.find((x) => x.id === editProviderId);
      if (
        p &&
        p.name === "新提供商" &&
        !p.baseUrl.trim() &&
        !p.apiKey.trim() &&
        p.models.length === 0
      ) {
        removeProvider(p.id);
      }
    }
    setEditProviderId(null);
  }

  /** 完成提供商编辑：校验并落库后关闭弹框 */
  async function saveProviderDraft() {
    const draftId = editProviderId!;
    // 若是新建的空 provider（无 baseUrl 且无启用模型），丢弃不保存
    const p = providers.find((x) => x.id === draftId);
    if (
      p &&
      !p.baseUrl.trim() &&
      p.models.filter((m) => m.enabled).length === 0
    ) {
      setProviders((prev) => prev.filter((x) => x.id !== draftId));
      setEditProviderId(null);
      return;
    }
    // 确保有已配置的模型再保存；否则提示
    if (!p?.baseUrl.trim() || !p.apiKey.trim()) {
      setTestState((prev) => ({
        ...prev,
        [draftId]: {
          testing: false,
          ok: false,
          error: "请先填写 BaseURL 与 API Key",
        },
      }));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers, channels }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.providers) setProviders(data.providers);
        setEditProviderId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  function removeProvider(id: string) {
    setProviders((prev) => prev.filter((p) => p.id !== id));
    setChannels((prev) => {
      const next: ChannelDraft = { ...prev };
      for (const k of ["text", "embedding", "image"] as const) {
        if (next[k] === id) delete next[k];
      }
      return next;
    });
  }

  function applyPreset(id: string, preset: (typeof PROVIDER_PRESETS)[number]) {
    updateProvider(id, {
      name: preset.name,
      baseUrl: preset.baseUrl,
      models: [{ id: preset.textModel, enabled: true, kinds: ["text"] }],
    });
    setTestState((prev) => ({ ...prev, [id]: { testing: false } }));
  }

  /** 调用 /api/settings/models 拉取可用模型，打开弹框供勾选 */
  async function openModelPicker(p: ProviderDraft) {
    setPickerFor(p.id);
    setPickerName(p.name);
    setPickerLoading(true);
    setPickerError(null);
    setPickerOpen(true);
    // 弹框里默认预勾选当前已启用（选中）的模型，并带出它们已有的类型标注
    const init: Record<string, ModelKind[]> = {};
    for (const m of p.models) {
      if (m.enabled) init[m.id] = [...m.kinds];
    }
    setPickerKinds(init);
    try {
      const res = await fetch("/api/settings/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: p.id,
          baseUrl: p.baseUrl,
          apiKey: p.apiKey,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPickerError(data?.error || "拉取失败");
        setPickerAll([]);
      } else {
        setPickerAll(Array.isArray(data?.models) ? data.models : []);
      }
    } catch {
      setPickerError("网络连接失败");
      setPickerAll([]);
    } finally {
      setPickerLoading(false);
    }
  }

  /** 确认弹框：只保留勾选的模型，enabled=true，类型标注取弹框内选择 */
  function confirmModelPicker() {
    const p = providers.find((x) => x.id === pickerFor);
    const all: ModelDraft[] = [
      // 手填模型（不在远端列表，如本地图片模型）始终保留
      ...(p?.models.filter((m) => !pickerAll.includes(m.id)) || []),
      ...pickerAll
        .filter((id) => pickerKinds[id] !== undefined)
        .map((id) => {
          return {
            id,
            enabled: true,
            kinds: pickerKinds[id] || [],
          };
        }),
    ];
    setProviders((prev) =>
      prev.map((pp) => (pp.id === pickerFor ? { ...pp, models: all } : pp)),
    );
    setPickerOpen(false);
  }

  /** 勾选 / 取消勾选一个模型 */
  function toggleModel(pId: string, modelId: string) {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === pId
          ? {
              ...p,
              models: p.models.map((m) =>
                m.id === modelId ? { ...m, enabled: !m.enabled } : m,
              ),
            }
          : p,
      ),
    );
  }

  /** 标注某模型的类型（多选切换） */
  function toggleModelKind(pId: string, modelId: string, kind: ModelKind) {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === pId
          ? {
              ...p,
              models: p.models.map((m) =>
                m.id === modelId
                  ? {
                      ...m,
                      kinds: m.kinds.includes(kind)
                        ? m.kinds.filter((k) => k !== kind)
                        : [...m.kinds, kind],
                    }
                  : m,
              ),
            }
          : p,
      ),
    );
  }

  /** 手动添加一个不在 /models 列表里的模型（如图片模型） */
  function addCustomModel(pId: string) {
    const name = (addModelInput[pId] || "").trim();
    if (!name) return;
    setProviders((prev) =>
      prev.map((p) =>
        p.id === pId
          ? {
              ...p,
              models: [...p.models, { id: name, enabled: true, kinds: [] }],
            }
          : p,
      ),
    );
    setAddModelInput((prev) => ({ ...prev, [pId]: "" }));
  }

  async function testProvider(p: ProviderDraft) {
    const textModel =
      p.models.find((m) => m.enabled && m.kinds.includes("text"))?.id || "";
    // 没有启用的文本模型时，不要用默认模型悄悄测试（会误导成 gpt-4o-mini）
    if (!textModel) {
      const enabledAny = p.models.some((m) => m.enabled);
      setTestState((prev) => ({
        ...prev,
        [p.id]: {
          testing: false,
          ok: false,
          error: enabledAny
            ? "请先给已勾选的模型标注「文本」类型，再测试连接"
            : "请先勾选并标注一个「文本」模型，再测试连接",
        },
      }));
      return;
    }
    setTestState((prev) => ({ ...prev, [p.id]: { testing: true } }));
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: p.baseUrl,
          apiKey: p.apiKey,
          model: textModel,
        }),
      });
      const data = await res.json().catch(() => null);
      setTestState((prev) => ({
        ...prev,
        [p.id]: {
          testing: false,
          ok: !!data?.ok,
          error: data?.error,
          latencyMs: data?.latencyMs,
        },
      }));
    } catch {
      setTestState((prev) => ({
        ...prev,
        [p.id]: { testing: false, ok: false, error: "网络连接失败" },
      }));
    }
  }

  /** 仅保存通道分配；提交时附带当前 providers（后端需整体落库） */
  async function saveChannels() {
    setChannelsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers, channels }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.channels) setChannels(data.channels);
        setChannelsSaved(true);
        setTimeout(() => setChannelsSaved(false), 2500);
      }
    } finally {
      setChannelsSaving(false);
    }
  }

  const kindOptions = (kind: "text" | "embedding" | "image") =>
    providers.flatMap((p) =>
      p.models
        .filter((m) => m.enabled && m.kinds.includes(kind))
        .map((m) => ({ id: p.id, label: `${p.name} · ${m.id}` })),
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 通道分配 */}
      <Card className="rounded-xl border bg-card shadow-xs">
        <CardHeader className="p-6 pb-4">
          <CardTitle className="text-base font-semibold">
            模型通道分配
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            为文本推理、向量嵌入与图片三类模型分别指定提供商；未指定的类别自动回退到第一个可用的提供商。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 grid gap-4 sm:grid-cols-3">
          <ChannelSelect
            label="文本模型通道"
            icon={MessageSquareText}
            hint="工坊流水线 / 智能整理 / AI 问答"
            value={channels.text}
            options={kindOptions("text")}
            onChange={(v) => setChannels((prev) => ({ ...prev, text: v }))}
          />
          <ChannelSelect
            label="嵌入模型通道"
            icon={Boxes}
            hint="向量化与语义检索"
            value={channels.embedding}
            options={kindOptions("embedding")}
            onChange={(v) => setChannels((prev) => ({ ...prev, embedding: v }))}
          />
          <ChannelSelect
            label="图片模型通道"
            icon={ImageIcon}
            hint="图片生成与理解（预留）"
            value={channels.image}
            options={kindOptions("image")}
            onChange={(v) => setChannels((prev) => ({ ...prev, image: v }))}
          />
        </CardContent>
        <div className="flex items-center justify-between border-t px-6 py-3">
          {channelsSaved ? (
            <span className="text-[11px] text-emerald-600">通道分配已保存</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              调整后记得保存，否则刷新会丢失。
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs rounded-md"
            onClick={saveChannels}
            disabled={channelsSaving}
          >
            {channelsSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            {channelsSaving ? "保存中..." : "保存通道分配"}
          </Button>
        </div>
      </Card>

      {/* 提供商列表 */}
      <div className="space-y-4">
        {providers.length === 0 && (
          <div className="rounded-lg border border-dashed py-10 text-center text-xs text-muted-foreground">
            尚未配置任何模型提供商，点击下方按钮添加（DeepSeek、智谱、Kimi、OpenAI、Ollama
            等任意 OpenAI 兼容端点）。
          </div>
        )}

        {providers.map((p, idx) => {
          const test = testState[p.id];
          const enabledModels = p.models.filter((m) => m.enabled);
          return (
            <div
              key={p.id}
              className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-foreground/20"
            >
              {/* 点击进入编辑 */}
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setEditProviderId(p.id)}
                title="编辑提供商"
              >
                <Badge
                  variant="outline"
                  className="shrink-0 text-[10px] font-normal rounded-md"
                >
                  #{idx + 1}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {p.name}
                    </span>
                    {!p.baseUrl && (
                      <span className="text-[10px] text-muted-foreground">
                        未配置
                      </span>
                    )}
                  </div>
                  {enabledModels.length === 0 ? (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      未勾选任何模型
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {enabledModels.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80"
                        >
                          {m.id}
                          {m.kinds.length > 0 && (
                            <span className="flex gap-0.5">
                              {MODEL_KINDS.filter((k) =>
                                m.kinds.includes(k.kind),
                              ).map((k) => (
                                <span key={k.kind} className={k.className}>
                                  {k.label}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground rounded-md"
                  onClick={() => testProvider(p)}
                  disabled={test?.testing || !p.baseUrl.trim()}
                  title="测试连接"
                >
                  {test?.testing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Radio className="size-3.5" />
                  )}
                  {test?.testing ? "测试中..." : "测试"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground rounded-md"
                  onClick={() => setEditProviderId(p.id)}
                >
                  <Settings className="size-3.5" />
                  <span className="hidden sm:inline">编辑</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-destructive"
                  title="删除该提供商"
                  onClick={() => removeProvider(p.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs rounded-md"
            onClick={addProvider}
          >
            <Plus className="size-3.5" />
            添加提供商
          </Button>
        </div>
      </div>

      {/* 拉取模型列表弹框 */}
      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => !open && setPickerOpen(false)}
      >
        <DialogContent className="sm:max-w-lg rounded-xl p-0 overflow-hidden">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <CheckCircle2 className="size-4 text-primary" />
              选择要使用的模型 · {pickerName}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              勾选要使用的模型，确认后只保留选中的；再给模型标注「文本/嵌入/图片」类型。
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto px-5 py-3">
            {pickerLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                正在从端点拉取模型列表...
              </div>
            ) : pickerError ? (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                <XCircle className="size-3.5 shrink-0" />
                拉取失败：{pickerError}
              </div>
            ) : pickerAll.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-xs text-muted-foreground">
                该端点未返回模型。可关闭后手动添加模型名。
              </div>
            ) : (
              <div className="space-y-1">
                {pickerAll.map((id) => {
                  const kinds = pickerKinds[id] || [];
                  const on = pickerKinds[id] !== undefined;
                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                        on ? "bg-muted/60" : "hover:bg-muted/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setPickerKinds((prev) => {
                            const next = { ...prev };
                            if (next[id] !== undefined) delete next[id];
                            else next[id] = [];
                            return next;
                          })
                        }
                        className="h-3.5 w-3.5 shrink-0 accent-foreground"
                      />
                      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90">
                        {id}
                      </code>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {MODEL_KINDS.map((k) => {
                          const kOn = kinds.includes(k.kind);
                          return (
                            <button
                              key={k.kind}
                              type="button"
                              onClick={() =>
                                setPickerKinds((prev) => {
                                  const cur = prev[id] || [];
                                  const nextKinds = cur.includes(k.kind)
                                    ? cur.filter((x) => x !== k.kind)
                                    : [...cur, k.kind];
                                  return { ...prev, [id]: nextKinds };
                                })
                              }
                              className={`h-5 rounded px-1.5 text-[10px] font-medium transition-colors ${
                                on && kOn
                                  ? "bg-muted " + k.className
                                  : "text-muted-foreground/35 hover:text-muted-foreground"
                              }`}
                              title={
                                on
                                  ? `标注为${k.label}模型${kOn ? "（取消）" : ""}`
                                  : "先勾选该模型再标注类型"
                              }
                              disabled={!on}
                            >
                              {k.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-b-xl border-t bg-muted/30 px-5 py-4">
            <span className="text-[11px] text-muted-foreground">
              已选{" "}
              <span className="font-semibold text-foreground">
                {Object.keys(pickerKinds).length}
              </span>{" "}
              个
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-md"
                onClick={() => setPickerOpen(false)}
              >
                取 消
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1 text-xs rounded-md font-semibold"
                onClick={confirmModelPicker}
                disabled={pickerLoading}
              >
                <Check className="size-3.5" />
                确认（只保留选中的）
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 提供商配置弹框：新建 / 编辑 */}
      {editProviderId &&
        (() => {
          const p = providers.find((x) => x.id === editProviderId);
          if (!p) return null;
          const test = testState[p.id];
          return (
            <Dialog
              open
              onOpenChange={(open) => !open && closeProviderEditor()}
            >
              <DialogContent className="sm:max-w-xl rounded-xl p-0 overflow-hidden">
                <DialogHeader className="border-b px-5 py-4">
                  <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                    <Settings className="size-4 text-primary" />
                    配置提供商
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    填写接口信息并选择要使用的模型；另外可给模型标注「文本/嵌入/图片」类型。
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 px-5 py-4 overflow-y-auto max-h-[60vh]">
                  {/* 名称 + 预置 */}
                  <div className="flex items-center gap-2">
                    <Label className="shrink-0 text-xs w-20">名称</Label>
                    <Input
                      value={p.name}
                      onChange={(e) =>
                        updateProvider(p.id, { name: e.target.value })
                      }
                      placeholder="提供商名称"
                      className="h-8 flex-1 text-sm font-semibold rounded-md"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      预置：
                    </span>
                    {PROVIDER_PRESETS.map((preset) => (
                      <Button
                        key={preset.name}
                        variant="outline"
                        size="sm"
                        className="h-6 rounded-md px-2 text-[11px] text-muted-foreground"
                        onClick={() => applyPreset(p.id, preset)}
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">API BaseURL</Label>
                      <Input
                        value={p.baseUrl}
                        onChange={(e) =>
                          updateProvider(p.id, { baseUrl: e.target.value })
                        }
                        placeholder="https://api.deepseek.com/v1"
                        className="font-mono text-xs rounded-md"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">API Key</Label>
                      <Input
                        type="password"
                        value={p.apiKey}
                        onChange={(e) =>
                          updateProvider(p.id, { apiKey: e.target.value })
                        }
                        placeholder="sk-..."
                        className="font-mono text-xs rounded-md"
                      />
                    </div>
                  </div>

                  {/* 模型选择与标注 */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="flex items-center gap-1 text-xs">
                        <CheckCircle2 className="size-3 text-primary" />
                        勾选使用的模型
                      </Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 text-[11px] rounded-md"
                        onClick={() => openModelPicker(p)}
                        disabled={!p.baseUrl.trim() || !p.apiKey.trim()}
                      >
                        <Download className="size-3" />
                        拉取模型列表
                      </Button>
                    </div>

                    {p.models.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-3 py-3 text-[11px] text-muted-foreground">
                        尚未添加模型。点击「拉取模型列表」自动获取，或下方手动输入模型名。
                      </div>
                    ) : (
                      <div className="divide-y divide-border overflow-hidden rounded-lg border">
                        {p.models.map((m) => (
                          <div
                            key={m.id}
                            className={`flex items-center gap-2 px-2.5 py-1.5 ${m.enabled ? "" : "opacity-50"}`}
                          >
                            <input
                              type="checkbox"
                              checked={m.enabled}
                              onChange={() => toggleModel(p.id, m.id)}
                              className="h-3.5 w-3.5 shrink-0 accent-foreground"
                            />
                            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90">
                              {m.id}
                            </code>
                            <div className="flex shrink-0 items-center gap-0.5">
                              {MODEL_KINDS.map((k) => {
                                const on = m.kinds.includes(k.kind);
                                return (
                                  <button
                                    key={k.kind}
                                    type="button"
                                    onClick={() =>
                                      toggleModelKind(p.id, m.id, k.kind)
                                    }
                                    className={`h-5 rounded px-1.5 text-[10px] font-medium transition-colors ${
                                      on
                                        ? "bg-muted " + k.className
                                        : "text-muted-foreground/40 hover:text-muted-foreground"
                                    }`}
                                    title={`标注为${k.label}模型${on ? "（取消）" : ""}`}
                                  >
                                    {k.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 手动添加模型兜底 */}
                    <div className="flex gap-2">
                      <Input
                        aria-label="手动添加模型名"
                        value={addModelInput[p.id] || ""}
                        onChange={(e) =>
                          setAddModelInput((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addCustomModel(p.id);
                        }}
                        placeholder="手动输入模型名，如 dall-e-3 / cogview-3 / text-embedding-3-small"
                        className="h-7 flex-1 font-mono text-[11px] rounded-md"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 gap-1 text-xs rounded-md"
                        onClick={() => addCustomModel(p.id)}
                        disabled={!(addModelInput[p.id] || "").trim()}
                      >
                        <Plus className="size-3.5" />
                        添加模型
                      </Button>
                    </div>
                  </div>

                  {/* 连通性测试 */}
                  <div className="flex items-center justify-between border-t pt-3">
                    {test && !test.testing && (test.ok || test.error) ? (
                      <span
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                          test.ok
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {test.ok ? (
                          <>
                            <CheckCircle2 className="size-3.5 shrink-0" />
                            连通成功 · 延迟 {test.latencyMs}ms
                          </>
                        ) : (
                          <>
                            <XCircle className="size-3.5 shrink-0" />
                            连接失败：{test.error}
                          </>
                        )}
                      </span>
                    ) : (
                      <span />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs rounded-md"
                      onClick={() => {
                        // 新建的无 id 匹配可能重复；重新用当前 p 测试
                        testProvider(p);
                      }}
                      disabled={test?.testing || !p.baseUrl.trim()}
                    >
                      {test?.testing ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Radio className="size-3.5" />
                      )}
                      {test?.testing ? "测试中..." : "测试连接"}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 rounded-b-xl border-t bg-muted/30 px-5 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-md"
                    onClick={closeProviderEditor}
                  >
                    取 消
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 gap-1 text-xs rounded-md font-semibold"
                    onClick={saveProviderDraft}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    {saving ? "保存中..." : "完成并保存"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
    </div>
  );
}

function ChannelSelect({
  label,
  icon: Icon,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: typeof KeyRound;
  hint: string;
  value?: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-xs">
        <Icon className="size-3 text-primary" />
        {label}
      </Label>
      <Select
        value={value || "none"}
        onValueChange={(v) => onChange(v === "none" ? "" : v)}
      >
        <SelectTrigger className="h-8 text-xs rounded-md">
          <SelectValue placeholder="自动回退" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">自动（第一个可用）</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

/* ============ 标签页二：文风语调档案 ============ */

function VoicesTab() {
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);

  // 声库试听
  const [previewVoice, setPreviewVoice] = useState<VoiceProfile | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [previewMock, setPreviewMock] = useState(false);

  const [reextractingId, setReextractingId] = useState<string | null>(null);

  useEffect(() => {
    fetchVoices();
  }, []);

  async function fetchVoices() {
    const res = await fetch("/api/voices");
    if (res.ok) {
      const data = await res.json();
      setVoices(data.voices);
    }
  }

  async function reextractVoice(id: string) {
    setReextractingId(id);
    try {
      await fetch(`/api/voices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      fetchVoices();
    } finally {
      setReextractingId(null);
    }
  }

  async function deleteVoice(id: string) {
    await fetch(`/api/voices/${id}`, { method: "DELETE" });
    fetchVoices();
  }

  async function handlePreview(voice: VoiceProfile) {
    setPreviewVoice(voice);
    setPreviewText("");
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: voice.id }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setPreviewText(data?.sample || "");
        setPreviewMock(!!data?.mock);
      } else {
        setPreviewText(data?.error || "生成失败，请稍后重试");
        setPreviewMock(false);
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border bg-card shadow-xs">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                文风语调档案 (Voice Profiles)
              </CardTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs rounded-md"
              onClick={() => setVoiceDialogOpen(true)}
            >
              <Plus className="size-3.5" />
              克隆新文风
            </Button>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            录入你的 3~5 篇历史代表作样稿，AI
            自动抽取文风特征并在起草工位挂载克隆。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-3">
          {voices.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
              暂无自定义文风档案，系统默认采用《出版级深度专栏风》。
            </div>
          ) : (
            <div className="space-y-3">
              {voices.map((v) => (
                <div
                  key={v.id}
                  className="flex items-start justify-between rounded-lg border p-4 text-xs transition-colors hover:bg-muted/30"
                >
                  <div className="space-y-1.5 pr-4">
                    <div className="font-semibold text-foreground">
                      {v.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      包含 {v.samples.length} 篇参考样稿
                    </div>
                    <p className="rounded-md bg-muted/60 p-2.5 font-mono text-[11px] leading-relaxed text-foreground/80">
                      {v.rulesPrompt}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground rounded-md"
                      onClick={() => handlePreview(v)}
                      disabled={previewLoading}
                    >
                      {previewLoading && previewVoice?.id === v.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      试听
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground rounded-md"
                      onClick={() => reextractVoice(v.id)}
                      disabled={reextractingId === v.id}
                    >
                      <RefreshCw
                        className={`size-3.5 ${reextractingId === v.id ? "animate-spin" : ""}`}
                      />
                      重新抽取
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive rounded-md"
                      onClick={() => deleteVoice(v.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 数据导出卡片移至独立标签页；此处保留试听结果弹窗 */}
      <Dialog
        open={!!previewVoice}
        onOpenChange={(open) => !open && setPreviewVoice(null)}
      >
        <DialogContent className="sm:max-w-lg rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Volume2 className="size-4 text-primary" />
              文风试听 · {previewVoice?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              以「把一件小事做到极致」为题生成的 120
              字样张，用于验证该文风约束的真实效果。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {previewLoading ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span className="text-xs">按该文风生成样张中...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {previewMock && (
                  <div className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                    未配置 BYOK 端点，以下为示意样张；配置后可听到真实克隆效果。
                  </div>
                )}
                <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-sans text-sm leading-relaxed text-foreground/90">
                  {previewText}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <NewVoiceDialog
        open={voiceDialogOpen}
        onOpenChange={setVoiceDialogOpen}
        onCreated={() => {
          setVoiceDialogOpen(false);
          fetchVoices();
        }}
      />
    </div>
  );
}

function NewVoiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [sample1, setSample1] = useState("");
  const [sample2, setSample2] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const samples = [sample1.trim(), sample2.trim()].filter(Boolean);
    if (!name.trim() || samples.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), samples }),
      });
      if (res.ok) {
        setName("");
        setSample1("");
        setSample2("");
        onCreated();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl rounded-xl p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-primary" />
            克隆个人文风语调
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            输入语调名称并粘贴 1~3
            篇你过往撰写的样稿正文，系统将自动抽取你的行文节奏与修辞约束。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">语调名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：老赵的犀利科技专栏 / 严谨商业研报"
              className="text-xs rounded-md"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">历史代表作样稿 1</Label>
            <Textarea
              value={sample1}
              onChange={(e) => setSample1(e.target.value)}
              placeholder="粘贴一篇你满意的历史文章全文或长片段..."
              className="min-h-24 text-xs font-mono rounded-md"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">历史代表作样稿 2（可选）</Label>
            <Textarea
              value={sample2}
              onChange={(e) => setSample2(e.target.value)}
              placeholder="粘贴另一篇样稿以提高抽取准确度..."
              className="min-h-24 text-xs font-mono rounded-md"
            />
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-md"
          >
            取消
          </Button>
          <Button
            size="sm"
            className="rounded-md font-semibold"
            onClick={handleCreate}
            disabled={saving || !name.trim() || !sample1.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1" />
                智能抽取文风中...
              </>
            ) : (
              "提取并保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ 标签页四：采集接口（浏览器插件） ============ */

function ExtensionTab() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regenArmed, setRegenArmed] = useState(false);
  const [copied, setCopied] = useState<"key" | "url" | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    fetch("/api/settings/clipkey")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setApiKey(data?.key || null);
        setOrigin(window.location.origin);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!regenArmed) return;
    const t = setTimeout(() => setRegenArmed(false), 3000);
    return () => clearTimeout(t);
  }, [regenArmed]);

  async function generateKey() {
    setGenerating(true);
    try {
      const res = await fetch("/api/settings/clipkey", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setApiKey(data.key);
        setRegenArmed(false);
      }
    } finally {
      setGenerating(false);
    }
  }

  function copyText(text: string, which: "key" | "url") {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  const endpoint = `${origin}/api/extension`;

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border bg-card shadow-xs">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center gap-2">
            <Puzzle className="size-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              浏览器插件 · 网页剪藏接口
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            配合墨匠剪藏插件（Vite + React，位于仓库 extension/
            目录），在任意网页一键采集正文或选中内容存入知识库。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">接口地址（插件中配置的服务 URL）</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={endpoint}
                className="font-mono text-xs rounded-md bg-muted/40"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 shrink-0 text-xs rounded-md"
                onClick={() => copyText(endpoint, "url")}
              >
                {copied === "url" ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied === "url" ? "已复制" : "复制"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">API Key</Label>
            {loading ? (
              <div className="h-10 animate-pulse rounded-md bg-muted/50" />
            ) : apiKey ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    readOnly
                    aria-label="插件密钥"
                    value={apiKey}
                    className="font-mono text-xs rounded-md bg-muted/40 break-all"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 shrink-0 text-xs rounded-md"
                    onClick={() => copyText(apiKey, "key")}
                  >
                    {copied === "key" ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copied === "key" ? "已复制" : "复制"}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    请妥善保管；重新生成后旧 Key 立即失效。
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 gap-1 text-xs rounded-md ${
                      regenArmed
                        ? "text-destructive hover:bg-destructive/10"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() =>
                      regenArmed ? void generateKey() : setRegenArmed(true)
                    }
                    disabled={generating}
                  >
                    {generating ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    {regenArmed ? "再次点击确认重新生成" : "重新生成"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4">
                <span className="text-xs text-muted-foreground">
                  尚未生成 API Key，生成后即可在插件中配置使用。
                </span>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs rounded-md font-semibold"
                  onClick={generateKey}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="size-3.5" />
                  )}
                  {generating ? "生成中..." : "生成 API Key"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-xs">
        <CardHeader className="p-6 pb-3">
          <CardTitle className="text-sm font-semibold">使用步骤</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <ol className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">1.</span> 在仓库{" "}
              <code className="rounded bg-muted px-1 font-mono text-[11px]">
                extension/
              </code>{" "}
              目录执行{" "}
              <code className="rounded bg-muted px-1 font-mono text-[11px]">
                pnpm install &amp;&amp; pnpm build
              </code>{" "}
              构建插件；
            </li>
            <li>
              <span className="font-semibold text-foreground">2.</span>{" "}
              打开浏览器{" "}
              <code className="rounded bg-muted px-1 font-mono text-[11px]">
                chrome://extensions
              </code>
              ，开启开发者模式，「加载已解压的扩展程序」选择{" "}
              <code className="rounded bg-muted px-1 font-mono text-[11px]">
                extension/dist
              </code>
              ；
            </li>
            <li>
              <span className="font-semibold text-foreground">3.</span>{" "}
              在插件设置中粘贴上方接口地址与 API Key，点击「测试连接」验证；
            </li>
            <li>
              <span className="font-semibold text-foreground">4.</span>{" "}
              在任意网页点击插件图标，采集正文或选中内容，确认后保存至主知识库。
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ 标签页三：数据导出与备份 ============ */

function ExportTab() {
  return (
    <Card className="rounded-xl border bg-card shadow-xs">
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center gap-2">
          <DatabaseBackup className="size-4 text-primary" />
          <CardTitle className="text-base font-semibold">
            数据导出与备份
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          本地优先意味着数据完全属于你：随时整包带走，SQLite 备份可替换
          data/inkcraft.sqlite 实现完整恢复。
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            asChild
            variant="outline"
            className="h-auto flex-col items-start gap-1.5 rounded-lg p-4 text-left"
          >
            <a href="/api/export/markdown" download>
              <FileDown className="size-4 text-primary" />
              <span className="text-xs font-semibold">
                导出 Markdown 全文包
              </span>
              <span className="text-[11px] font-normal leading-relaxed text-muted-foreground">
                全部知识条目与装配成果，纯文本可读可迁移
              </span>
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-auto flex-col items-start gap-1.5 rounded-lg p-4 text-left"
          >
            <a href="/api/export/sqlite" download>
              <Database className="size-4 text-primary" />
              <span className="text-xs font-semibold">
                下载 SQLite 完整备份
              </span>
              <span className="text-[11px] font-normal leading-relaxed text-muted-foreground">
                含全部表、索引与 FTS 数据，可整体恢复
              </span>
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
