"use client";

import { Edit3, Sparkles, UserCheck, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { StageBadge } from "@/components/badges";
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
import { Textarea } from "@/components/ui/textarea";
import type { AgentItem } from "@/lib/types";

const STAGE_LABELS: Record<string, { name: string; step: string }> = {
  topic: { name: "01 选题策划", step: "工步一" },
  evidence: { name: "02 素材匹配", step: "工步二" },
  draft: { name: "03 初稿起草", step: "工步三" },
  review: { name: "04 编审审查", step: "工步四" },
  extract: { name: "05 卡片萃取", step: "独立工位" },
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [editingAgent, setEditingAgent] = useState<AgentItem | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Users className="size-5 text-muted-foreground" />
          编辑部
          <span className="text-sm font-normal text-muted-foreground">The Editorial Staff</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          流水线工位人格名册，各工步的专属 AI 专家，可配置人格设定、文风提示词与模型温度。
        </p>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((agent) => (
            <Card key={agent.id} className="relative flex flex-col justify-between gap-1.5 rounded-xl border bg-card py-0 shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm">
              <CardHeader className="gap-1.5 px-4 pt-3 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <StageBadge stage={agent.stage} />
                  <Badge variant="secondary" className="gap-1 text-[11px] font-normal rounded-md">
                    <UserCheck className="size-3" />
                    {agent.isPreset ? "预置工位" : "自定义"}
                  </Badge>
                </div>
                <CardTitle className="text-sm font-semibold">{agent.name}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {agent.persona || "暂无人格口吻说明"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2 px-4 pt-0 pb-3">
                <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="shrink-0">模型 <code className="font-semibold text-foreground">{agent.model || "跟随全局"}</code></span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="shrink-0">温度 <code className="font-semibold text-foreground">{agent.temperature}</code></span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 gap-1 px-2 text-xs rounded-md hover:text-foreground"
                  onClick={() => setEditingAgent(agent)}
                >
                  <Edit3 className="size-3.5" />
                  配置
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editingAgent && (
        <EditAgentDialog
          agent={editingAgent}
          open={!!editingAgent}
          onOpenChange={(open) => !open && setEditingAgent(null)}
          onSaved={() => {
            setEditingAgent(null);
            fetchAgents();
          }}
        />
      )}
    </div>
  );
}

function EditAgentDialog({
  agent,
  open,
  onOpenChange,
  onSaved,
}: {
  agent: AgentItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(agent.name);
  const [persona, setPersona] = useState(agent.persona || "");
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [model, setModel] = useState(agent.model || "");
  const [saving, setSaving] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl rounded-xl p-5 max-h-[85dvh] overflow-y-auto no-scrollbar"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-primary" />
            配置工位人格 · {STAGE_LABELS[agent.stage]?.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            调整工位名称、专业人设口吻与提示词，指导流水线在当前工步的表现。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">工位名称</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：周主编 · 金线审校"
                className="rounded-md text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model" className="text-xs">专用模型（留空跟随全局）</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="例如：gpt-4o / deepseek-chat"
                className="rounded-md text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="persona" className="text-xs">人格设定 (Persona)</Label>
            <Input
              id="persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="简要描述专家背景、审美品味与行文口吻"
              className="rounded-md text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prompt" className="text-xs">系统提示词 (System Prompt)</Label>
            <Textarea
              id="prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-36 max-h-[45vh] overflow-y-auto font-mono text-xs leading-relaxed rounded-md"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <Label htmlFor="temp">采样温度 (Temperature): {temperature}</Label>
              <span className="text-muted-foreground">
                {temperature < 0.5 ? "确定严谨" : temperature > 0.8 ? "发散创造" : "平衡折中"}
              </span>
            </div>
            <input
              id="temp"
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-md">
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim() || !systemPrompt.trim()} className="rounded-md font-semibold">
            {saving ? "保存中..." : "保存配置"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
