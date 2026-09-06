"use client";

import {
  Check,
  ChevronDown,
  Edit3,
  Feather,
  Globe,
  ImageIcon,
  Layers,
  PenLine,
  Plus,
  Power,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AgentStageBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { AgentItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const STAGE_LABELS: Record<string, { name: string; step: string }> = {
  wechat: { name: "微信公众号主笔", step: "平台写作技能" },
  xiaohongshu: { name: "小红书笔记创作", step: "平台写作技能" },
  zhihu: { name: "知乎回答答主", step: "平台写作技能" },
  x_thread: { name: "X / 即刻短推手", step: "平台写作技能" },
  master: { name: "通用母稿主笔", step: "平台写作技能" },
  image_gen: { name: "文生图 · 视觉配图", step: "视觉生图技能" },
  topic: { name: "01 选题策划", step: "工位一" },
  brief: { name: "02 锁题定调", step: "工位二" },
  evidence: { name: "03 取证装箱", step: "工位三" },
  draft: { name: "04 初稿起草", step: "工位四" },
  review: { name: "05 核稿审查", step: "工位五" },
  extract: { name: "06 卡片萃取", step: "独立工位" },
};

const PLATFORM_STAGES = new Set([
  "wechat",
  "xiaohongshu",
  "zhihu",
  "x_thread",
  "master",
  "image_gen",
]);

interface ConfiguredModel {
  id: string;
  name: string;
  provider: string;
  kinds: ("text" | "embedding" | "image")[];
}

const COMMON_TEXT_MODELS = [
  "deepseek-chat",
  "deepseek-reasoner",
  "gpt-4o",
  "gpt-4o-mini",
  "claude-3-5-sonnet",
  "claude-3-5-haiku",
  "qwen-plus",
  "qwen-max",
  "glm-4-plus",
  "moonshot-v1-32k",
];

const COMMON_IMAGE_MODELS = [
  "dall-e-3",
  "dall-e-2",
  "flux-1.1-pro",
  "flux-schnell",
  "stable-diffusion-3",
  "midjourney-v6",
  "cogview-3-plus",
  "sdxl-turbo",
];

function isImageSkill(agent: AgentItem): boolean {
  return (
    agent.stage === "image_gen" ||
    agent.id.includes("image") ||
    agent.stage?.startsWith("img_")
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [editingAgent, setEditingAgent] = useState<AgentItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AgentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [availableModels, setAvailableModels] = useState<ConfiguredModel[]>([]);
  const [skillModalityFilter, setSkillModalityFilter] = useState<"all" | "text" | "image">("all");

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettingsModels = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const modelsList: ConfiguredModel[] = [];
        (data?.providers || []).forEach((p: any) => {
          (p.models || []).forEach((m: any) => {
            if (m?.id && m?.enabled) {
              modelsList.push({
                id: m.id,
                name: m.id,
                provider: p.name || "Provider",
                kinds: Array.isArray(m.kinds) ? m.kinds : ["text"],
              });
            }
          });
        });
        setAvailableModels(modelsList);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchSettingsModels();
  }, [fetchAgents, fetchSettingsModels]);

  async function toggleAgentEnabled(agent: AgentItem) {
    const nextState = agent.enabled === false ? true : false;
    // 乐观更新
    setAgents((prev) =>
      prev.map((a) => (a.id === agent.id ? { ...a, enabled: nextState } : a))
    );
    try {
      await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState }),
      });
    } catch {
      fetchAgents();
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${pendingDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== pendingDelete.id));
        setPendingDelete(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  // 平台创作技能（含文生图与自定义创作技能）
  const platformSkills = agents.filter(
    (a) => PLATFORM_STAGES.has(a.stage) || a.id.startsWith("custom_") || a.id.startsWith("img_custom_")
  );
  // 流水线基础工位
  const pipelineAgents = agents.filter(
    (a) => !PLATFORM_STAGES.has(a.stage) && !a.id.startsWith("custom_") && !a.id.startsWith("img_custom_")
  );

  const textSkillsCount = platformSkills.filter((a) => !isImageSkill(a)).length;
  const imageSkillsCount = platformSkills.filter((a) => isImageSkill(a)).length;

  const filteredPlatformSkills = platformSkills.filter((a) => {
    if (skillModalityFilter === "text") return !isImageSkill(a);
    if (skillModalityFilter === "image") return isImageSkill(a);
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Users className="size-5 text-muted-foreground" />
            编辑部
            <span className="text-sm font-normal text-muted-foreground">The Editorial Staff</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            平台写作与视觉生图技能名册，区分文本创作与视觉配图，支持启用/禁用与自定义扩展。
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 rounded-md text-xs font-semibold shadow-xs"
        >
          <Plus className="size-3.5" />
          新增技能
        </Button>
      </header>

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-xl border bg-muted/40" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 第一组：平台创作与生图技能 */}
          <section className="space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <div className="flex items-center gap-2">
                <Feather className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  平台创作与生图技能 ({platformSkills.length})
                </h2>
              </div>

              {/* 模态筛选标签 */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSkillModalityFilter("all")}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                    skillModalityFilter === "all"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  )}
                >
                  全部 ({platformSkills.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSkillModalityFilter("text")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                    skillModalityFilter === "text"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  )}
                >
                  <PenLine className="size-3" />
                  <span>生文 · 文本创作 ({textSkillsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSkillModalityFilter("image")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                    skillModalityFilter === "image"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  )}
                >
                  <ImageIcon className="size-3 text-amber-500" />
                  <span>生图 · 视觉配图 ({imageSkillsCount})</span>
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPlatformSkills.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onEdit={() => setEditingAgent(agent)}
                  onToggleEnabled={() => toggleAgentEnabled(agent)}
                  onDelete={() => setPendingDelete(agent)}
                />
              ))}
            </div>
          </section>

          {/* 第二组：工坊流水线工位 */}
          <section className="space-y-3.5">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">
                  工坊流水线工位 ({pipelineAgents.length})
                </h2>
              </div>
              <span className="text-xs text-muted-foreground">
                负责选题操盘、论据取证、编审核稿与知识萃取
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pipelineAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onEdit={() => setEditingAgent(agent)}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* 新增技能弹窗 */}
      <CreateAgentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        configuredModels={availableModels}
        onCreated={() => {
          setCreateOpen(false);
          fetchAgents();
        }}
      />

      {/* 编辑技能弹窗 */}
      {editingAgent && (
        <EditAgentDialog
          agent={editingAgent}
          open={!!editingAgent}
          configuredModels={availableModels}
          onOpenChange={(open) => !open && setEditingAgent(null)}
          onSaved={() => {
            setEditingAgent(null);
            fetchAgents();
          }}
        />
      )}

      {/* 删除自定义技能确认弹框 */}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-sm rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <Trash2 className="size-4" />
              </span>
              删除该技能？
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              《{pendingDelete?.name}》将被永久移除。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-md text-xs"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="rounded-md text-xs bg-destructive font-semibold text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "删除中…" : "确认删除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentCard({
  agent,
  onEdit,
  onToggleEnabled,
  onDelete,
}: {
  agent: AgentItem;
  onEdit: () => void;
  onToggleEnabled?: () => void;
  onDelete?: () => void;
}) {
  const isCustom = !agent.isPreset;
  const isImage = isImageSkill(agent);
  const isEnabled = agent.enabled !== false;

  return (
    <Card
      className={cn(
        "relative flex flex-col justify-between min-h-[200px] rounded-xl border bg-card p-4 shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm",
        !isEnabled && "opacity-60 bg-muted/20 border-dashed"
      )}
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AgentStageBadge stage={agent.stage} />
            {/* 模态属性标签（生文 / 生图） */}
            {isImage ? (
              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0 text-[10px] font-medium leading-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <ImageIcon className="size-3" />
                <span>生图</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0 text-[10px] font-medium leading-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <PenLine className="size-3" />
                <span>生文</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* 启用/禁用切换按钮 */}
            {onToggleEnabled && (
              <button
                type="button"
                onClick={onToggleEnabled}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer border",
                  isEnabled
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                    : "border-border bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
                title={isEnabled ? "点击禁用该技能" : "点击启用该技能"}
              >
                <span className={cn("size-1.5 rounded-full", isEnabled ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                <span>{isEnabled ? "已启用" : "已禁用"}</span>
              </button>
            )}

            <Badge
              variant={isCustom ? "outline" : "secondary"}
              className="gap-1 text-[10px] font-normal rounded-md px-1.5 py-0 h-5"
            >
              <UserCheck className="size-3" />
              {agent.isPreset ? "预置专家" : "自定义"}
            </Badge>
          </div>
        </div>

        <div>
          <CardTitle className={cn("text-sm font-semibold", !isEnabled && "line-through text-muted-foreground")}>
            {agent.name}
          </CardTitle>
          <CardDescription className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {agent.persona || "暂无人格口吻说明"}
          </CardDescription>
        </div>
      </div>

      <div className="mt-3.5 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="shrink-0">
            模型 <code className="font-semibold text-foreground text-[10px]">{agent.model || "全局"}</code>
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="shrink-0">
            温度 <code className="font-semibold text-foreground text-[10px]">{agent.temperature}</code>
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isCustom && onDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 rounded-md text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              title="删除自定义技能"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs rounded-md hover:text-foreground font-medium"
            onClick={onEdit}
          >
            <Edit3 className="size-3.5" />
            配置
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** 模态自适应模型选择器 */
function ModelSelectorInput({
  modality,
  model,
  onChange,
  configuredModels,
}: {
  modality: "text" | "image";
  model: string;
  onChange: (val: string) => void;
  configuredModels: ConfiguredModel[];
}) {
  const [customMode, setCustomMode] = useState(false);

  // 过滤当前模态匹配的已配置模型
  const matchedConfigured = configuredModels.filter((m) =>
    modality === "image" ? m.kinds.includes("image") : m.kinds.includes("text")
  );

  const fallbackPresets = modality === "image" ? COMMON_IMAGE_MODELS : COMMON_TEXT_MODELS;

  // 全部候选项去重
  const candidateIds = Array.from(
    new Set([...matchedConfigured.map((m) => m.id), ...fallbackPresets])
  );

  const isMatchedInList = candidateIds.includes(model);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">
          专用模型（{modality === "image" ? "🎨 视觉生图通道" : "📝 文本生成通道"}）
        </Label>
        <span className="text-[10px] text-muted-foreground">
          {model ? `已指定: ${model}` : "跟随全局默认通道"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={model ? (isMatchedInList ? model : "custom") : "global"}
          onValueChange={(val) => {
            if (val === "global") {
              setCustomMode(false);
              onChange("");
            } else if (val === "custom") {
              setCustomMode(true);
            } else {
              setCustomMode(false);
              onChange(val);
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs font-medium rounded-md flex-1 bg-background">
            <SelectValue placeholder="跟随全局默认通道" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global" className="text-xs">
              🌐 跟随全局默认通道
            </SelectItem>

            {matchedConfigured.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                  已在设置中配置的模型：
                </div>
                {matchedConfigured.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <span className="font-semibold">{m.id}</span>
                    <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">
                      ({m.provider})
                    </span>
                  </SelectItem>
                ))}
              </>
            )}

            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">
              推荐常用 {modality === "image" ? "生图" : "文本"} 模型：
            </div>
            {fallbackPresets.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {m}
              </SelectItem>
            ))}

            <SelectItem value="custom" className="text-xs text-primary font-medium">
              ✍️ 自定义手动输入模型 ID...
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(customMode || (!isMatchedInList && model !== "")) && (
        <Input
          value={model}
          onChange={(e) => onChange(e.target.value)}
          placeholder={modality === "image" ? "输入生图模型名，如 dall-e-3 / flux-schnell" : "输入模型名，如 gpt-4o / deepseek-chat"}
          className="h-7 text-xs rounded-md mt-1"
        />
      )}
    </div>
  );
}

function CreateAgentDialog({
  open,
  onOpenChange,
  configuredModels,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuredModels: ConfiguredModel[];
  onCreated: () => void;
}) {
  const [modality, setModality] = useState<"text" | "image">("text");
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [model, setModel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleModalityChange(type: "text" | "image") {
    setModality(type);
    if (type === "image") {
      if (!name) setName("灵境 · 专属视觉配图师");
      if (!persona) setPersona("AI 生图提示词专家，擅长将文字提炼为高品质 Midjourney 英文生图词与视觉封面构图");
      if (!systemPrompt) {
        setSystemPrompt(`你是顶尖的视觉概念总监与 AI 生图提示词（Prompt）专家。根据输入的文章内容或核心主题，你的任务是提炼出最具视觉冲击力、传意精准的配图与封面方案。

请输出结构化方案：
1. **封面设计概念**：一句话说明配图的视觉隐喻与艺术风格；
2. **生图中文提示词**：包含主体描摹、环境构图、色彩搭配、光影质感与镜头角度；
3. **生图英文提示词 (Midjourney / SD)**：标准且经过调优的高质量英文生图 Prompt（包含参数如 --ar 16:9 或 --ar 3:4，--v 6.0 等）；
4. **负向提示词 (Negative Prompt)**：需排除的低质元素。`);
      }
      setTemperature(0.75);
    } else {
      if (name.includes("视觉配图师")) setName("");
      if (persona.includes("生图提示词")) setPersona("");
      if (systemPrompt.includes("Midjourney")) setSystemPrompt("");
      setTemperature(0.7);
    }
  }

  async function handleCreate() {
    if (!name.trim() || !systemPrompt.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const stage = modality === "image" ? `img_custom_${Date.now()}` : `custom_${Date.now()}`;
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          stage,
          persona: persona.trim() || null,
          systemPrompt: systemPrompt.trim(),
          temperature,
          model: model.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "创建失败");
      }
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建失败，请稍后重试");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl rounded-xl p-5 max-h-[85dvh] overflow-y-auto no-scrollbar"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Plus className="size-4 text-primary" />
            新增创作/生图技能
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            支持新增「文本创作」或「视觉生图」技能，根据所选类型动态分配模型通道与提示词模板。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* 模态选择器 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">技能类型 *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModalityChange("text")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all cursor-pointer",
                  modality === "text"
                    ? "border-primary bg-primary/5 text-foreground shadow-xs ring-1 ring-primary/20"
                    : "border-border/70 bg-card text-muted-foreground hover:bg-muted/30"
                )}
              >
                <PenLine className="size-3.5 text-emerald-500" />
                <span>📝 生文 · 文本创作技能</span>
              </button>
              <button
                type="button"
                onClick={() => handleModalityChange("image")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all cursor-pointer",
                  modality === "image"
                    ? "border-amber-500 bg-amber-500/5 text-foreground shadow-xs ring-1 ring-amber-500/20"
                    : "border-border/70 bg-card text-muted-foreground hover:bg-muted/30"
                )}
              >
                <ImageIcon className="size-3.5 text-amber-500" />
                <span>🎨 生图 · 视觉配图技能</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="create-name" className="text-xs font-medium">技能名称 *</Label>
              <Input
                id="create-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={modality === "image" ? "例如：灵境 · 封面生图专家" : "例如：科技早报主编"}
                className="rounded-md text-xs h-8"
              />
            </div>
            {/* 动态模型选择器 */}
            <ModelSelectorInput
              modality={modality}
              model={model}
              onChange={setModel}
              configuredModels={configuredModels}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-persona" className="text-xs font-medium">人格与调性定位 (Persona)</Label>
            <Input
              id="create-persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="简要描述专家背景、排版规范或生图风格偏好"
              className="rounded-md text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-prompt" className="text-xs font-medium">系统提示词与准则 (System Prompt) *</Label>
            <Textarea
              id="create-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-44 max-h-[45vh] overflow-y-auto font-mono text-xs leading-relaxed rounded-md"
              placeholder={modality === "image" ? "编写详细的生图 Prompt 生成准则、参数要求与负向提示词规范……" : "编写详细的写作规范、结构要求与排版准则……"}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="create-temperature" className="text-xs font-medium">
                模型创造力 (Temperature): <span className="font-mono font-semibold">{temperature}</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                0.2 严谨结构 · 0.7 均衡生动 · 1.0 极富发散
              </span>
            </div>
            <input
              id="create-temperature"
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-md text-xs">
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating || !name.trim() || !systemPrompt.trim()}
            className="rounded-md text-xs font-semibold"
          >
            {creating ? "创建中…" : "创建技能"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAgentDialog({
  agent,
  open,
  configuredModels,
  onOpenChange,
  onSaved,
}: {
  agent: AgentItem;
  open: boolean;
  configuredModels: ConfiguredModel[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [modality, setModality] = useState<"text" | "image">(
    isImageSkill(agent) ? "image" : "text"
  );
  const [name, setName] = useState(agent.name);
  const [persona, setPersona] = useState(agent.persona || "");
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [model, setModel] = useState(agent.model || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setModality(isImageSkill(agent) ? "image" : "text");
    setName(agent.name);
    setPersona(agent.persona || "");
    setSystemPrompt(agent.systemPrompt);
    setTemperature(agent.temperature);
    setModel(agent.model || "");
  }, [agent]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          persona,
          systemPrompt,
          temperature,
          model: model.trim() || null,
        }),
      });
      if (res.ok) {
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  const stageMeta = STAGE_LABELS[agent.stage] || { name: agent.name, step: "创作专家" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl rounded-xl p-5 max-h-[85dvh] overflow-y-auto no-scrollbar"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border",
                modality === "image"
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              )}
            >
              {modality === "image" ? <ImageIcon className="size-3" /> : <PenLine className="size-3" />}
              <span>{modality === "image" ? "视觉生图技能" : "文本创作技能"}</span>
            </span>
            <DialogTitle className="text-base font-semibold">
              配置 · {stageMeta.name}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            调整专家名称、人设定位、专用模型与系统提示词，保存后将在创作流中即时生效。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 模态切换 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">技能类型属性</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModality("text")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border p-2 text-xs font-semibold transition-all cursor-pointer",
                  modality === "text"
                    ? "border-primary bg-primary/5 text-foreground shadow-xs ring-1 ring-primary/20"
                    : "border-border/70 bg-card text-muted-foreground hover:bg-muted/30"
                )}
              >
                <PenLine className="size-3.5 text-emerald-500" />
                <span>📝 生文 · 文本创作</span>
              </button>
              <button
                type="button"
                onClick={() => setModality("image")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border p-2 text-xs font-semibold transition-all cursor-pointer",
                  modality === "image"
                    ? "border-amber-500 bg-amber-500/5 text-foreground shadow-xs ring-1 ring-amber-500/20"
                    : "border-border/70 bg-card text-muted-foreground hover:bg-muted/30"
                )}
              >
                <ImageIcon className="size-3.5 text-amber-500" />
                <span>🎨 生图 · 视觉配图</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium">专家/技能名称</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：林悦读 · 微信公众号主笔"
                className="rounded-md text-xs h-8"
              />
            </div>
            {/* 模态关联的动态模型选择器 */}
            <ModelSelectorInput
              modality={modality}
              model={model}
              onChange={setModel}
              configuredModels={configuredModels}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="persona" className="text-xs font-medium">人格与调性定位 (Persona)</Label>
            <Input
              id="persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="简要描述专家背景、排版风格与行文口吻"
              className="rounded-md text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt" className="text-xs font-medium">系统提示词与规范 (System Prompt)</Label>
            <Textarea
              id="prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-44 max-h-[45vh] overflow-y-auto font-mono text-xs leading-relaxed rounded-md"
              placeholder="编写详细的提示词规范……"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature" className="text-xs font-medium">
                模型创造力 (Temperature): <span className="font-mono font-semibold">{temperature}</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">
                0.2 极其严谨 · 0.7 均衡生动 · 1.0 极富发散
              </span>
            </div>
            <input
              id="temperature"
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-md text-xs">
            取消
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !name.trim() || !systemPrompt.trim()}
            className="rounded-md text-xs font-semibold"
          >
            {saving ? "保存中…" : "保存配置"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
