"use client";

import {
  Brain,
  Check,
  Compass,
  Copy,
  Download,
  FileText,
  History,
  ImageIcon,
  Layers,
  Loader2,
  MessageSquare,
  PenLine,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { VoiceProfile } from "@/app/api/voices/route";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PLATFORM_SKILLS,
  type AgentItem,
  type PipelineProject,
  type PlatformSkillId,
  type ProjectSnapshot,
} from "@/lib/types";
import { copyWeChatRichText } from "@/lib/wechat-format";
import { cn } from "@/lib/utils";
import { AiCoverDialog } from "./ai-cover-dialog";
import { MaterialsSidebar } from "./materials-sidebar";
import { MockNotice } from "./mock-notice";
import { QuoteCardDialog } from "./quote-card-dialog";
import { SaveToKbDialog } from "./save-to-kb-dialog";
import { useWorkshopToast } from "./toast";
import { VariantsDrawer } from "./variants-drawer";
import { VersionHistoryDialog } from "./version-history-dialog";

interface WorkshopDeskProps {
  project: PipelineProject;
  canvasContent: string;
  saving: boolean;
  onContentChange: (content: string) => void;
  onProjectUpdate: (updated: PipelineProject) => void;
  onNewProject: () => void;
  onSaveContentNow: (content: string) => Promise<void>;
}

export function WorkshopDesk({
  project,
  canvasContent,
  saving,
  onContentChange,
  onProjectUpdate,
  onNewProject,
  onSaveContentNow,
}: WorkshopDeskProps) {
  const toast = useWorkshopToast();

  const [title, setTitle] = useState(project.title);
  const [targetSkill, setTargetSkill] = useState<PlatformSkillId>(
    project.targetSkill || "wechat"
  );
  const [skillAgents, setSkillAgents] = useState<AgentItem[]>([]);
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("none");
  const [drafting, setDrafting] = useState(false);
  const [draftMock, setDraftMock] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [saveToKbOpen, setSaveToKbOpen] = useState(false);
  const [saveToKbPlatform, setSaveToKbPlatform] = useState("master");
  const [quoteCardOpen, setQuoteCardOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wechatCopied, setWechatCopied] = useState(false);

  const variants = project.variants || {};
  const snapshots = project.snapshots || [];

  // 同步项目外部变更
  useEffect(() => {
    setTitle(project.title);
    if (project.targetSkill) setTargetSkill(project.targetSkill);
  }, [project.title, project.targetSkill]);

  // 加载编辑部中的所有创作技能（包含用户自定义与文生图，且只展示已启用的技能）
  useEffect(() => {
    fetch("/api/agents")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = (data?.agents || []).filter(
          (a: AgentItem) =>
            (["wechat", "xiaohongshu", "zhihu", "x_thread", "master", "image_gen"].includes(a.stage) ||
              a.id.startsWith("custom_")) &&
            a.enabled !== false
        );
        setSkillAgents(list);
        if (list.length > 0) {
          const isCurrentActive = list.some((a: AgentItem) => a.stage === targetSkill || a.id === targetSkill);
          if (!isCurrentActive) {
            const fallbackSkill = (list[0].stage || list[0].id) as PlatformSkillId;
            setTargetSkill(fallbackSkill);
          }
        }
      })
      .catch(() => {});
  }, [targetSkill]);

  // 加载文风档案
  useEffect(() => {
    fetch("/api/voices")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setVoices(data?.voices || []))
      .catch(() => {});
  }, []);

  // 保存快照
  async function handleSaveSnapshot(content: string, trigger: "draft" | "manual" = "manual") {
    if (!content.trim()) return;
    const newSnap: ProjectSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toLocaleString("zh-CN"),
      wordCount: content.replace(/<[^>]*>/g, "").trim().length,
      preview: content.slice(0, 120).replace(/\n/g, " "),
      content,
      trigger,
    };
    const currentSnaps = project.snapshots || [];
    const updated = [newSnap, ...currentSnaps].slice(0, 10);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshots: updated }),
      });
      if (res.ok) {
        const data = await res.json();
        onProjectUpdate(data.project);
        if (trigger === "manual") {
          toast("已拍摄草稿历史快照！", "success");
        }
      }
    } catch {}
  }

  // 恢复快照
  async function handleRestoreSnapshot(restoredContent: string) {
    onContentChange(restoredContent);
    await onSaveContentNow(restoredContent);
    toast("已成功恢复至该历史快照版本", "success");
  }

  // 删除快照
  async function handleDeleteSnapshot(snapId: string) {
    const updated = (project.snapshots || []).filter((s) => s.id !== snapId);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshots: updated }),
      });
      if (res.ok) {
        const data = await res.json();
        onProjectUpdate(data.project);
      }
    } catch {}
  }

  // 修改标题
  async function handleTitleBlur() {
    const t = title.trim();
    if (!t || t === project.title) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      if (res.ok) {
        const data = await res.json();
        onProjectUpdate(data.project);
      }
    } catch {}
  }

  // 切换技能
  async function handleSkillChange(newSkill: PlatformSkillId) {
    setTargetSkill(newSkill);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSkill: newSkill }),
      });
      if (res.ok) {
        const data = await res.json();
        onProjectUpdate(data.project);
      }
    } catch {}
  }

  // 当前匹配的技能 Agent 实体
  const currentAgent =
    skillAgents.find((a) => a.stage === targetSkill || a.id === targetSkill) ||
    skillAgents.find((a) => a.stage === "wechat") ||
    null;

  const currentSkillMeta = PLATFORM_SKILLS.find((s) => s.id === targetSkill) || PLATFORM_SKILLS[0];
  const currentSkillDisplayName = currentAgent?.name || currentSkillMeta.name;
  const currentSkillDesc = currentAgent?.persona || currentSkillMeta.desc;

  // 流式起草
  async function runDraft() {
    if (drafting) return;

    // 若当前已有超过 30 字的手写/已有草稿，起草前自动备份快照
    if (canvasContent.trim().length >= 30) {
      await handleSaveSnapshot(canvasContent, "draft");
    }

    setDrafting(true);
    setDraftMock(false);
    onContentChange("");

    try {
      const res = await fetch("/api/pipeline/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          targetSkill,
          agentId: currentAgent?.id,
          voiceProfileId: selectedVoiceId !== "none" ? selectedVoiceId : undefined,
          claimSnapshot: project.claimSnapshot,
          materials: project.materials,
        }),
      });

      if (!res.ok) throw new Error("起草失败");

      const isMock = res.headers.get("X-Is-Mock") === "true";
      setDraftMock(isMock);

      if (isMock) {
        const text = await res.text();
        onContentChange(text);
        await onSaveContentNow(text);
        toast("已生成初稿（演示模式）", "success");
        return;
      }

      if (!res.body) throw new Error("无返回流");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        onContentChange(acc);
      }

      await onSaveContentNow(acc);
      try {
        const stageRes = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentStage: "completed" }),
        });
        if (stageRes.ok) {
          const data = await stageRes.json();
          onProjectUpdate(data.project);
        }
      } catch {}
      toast("起草完成！", "success");
    } catch (err: any) {
      toast(err?.message || "起草遇到问题，请重试", "error");
    } finally {
      setDrafting(false);
    }
  }

  // 复制 Markdown 正文
  function handleCopy() {
    if (!canvasContent.trim()) return;
    navigator.clipboard.writeText(canvasContent);
    setCopied(true);
    toast("已复制 Markdown 正文", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  // 复制微信公众号富文本
  async function handleCopyWeChat() {
    if (!canvasContent.trim()) return;
    const ok = await copyWeChatRichText(canvasContent, { theme: "emerald", title });
    if (ok) {
      setWechatCopied(true);
      toast("已复制公众号带排版富文本，可直接粘贴！", "success");
      setTimeout(() => setWechatCopied(false), 2000);
    } else {
      handleCopy();
    }
  }

  // 插入文本到画布
  function handleInsertText(text: string) {
    onContentChange(canvasContent ? `${canvasContent}\n${text}` : text);
    toast("已引用到正文", "success");
  }

  const getSkillIcon = (id: string) => {
    switch (id) {
      case "wechat":
        return <MessageSquare className="size-3.5 text-emerald-500 shrink-0" />;
      case "xiaohongshu":
        return <Sparkles className="size-3.5 text-rose-500 shrink-0" />;
      case "zhihu":
        return <Compass className="size-3.5 text-blue-500 shrink-0" />;
      case "x_thread":
        return <Share2 className="size-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />;
      case "image_gen":
        return <ImageIcon className="size-3.5 text-amber-500 shrink-0" />;
      default:
        return <FileText className="size-3.5 text-purple-500 shrink-0" />;
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* 顶部工具栏（标题、保存状态与全局操作） */}
      <header className="flex flex-col sm:flex-row sm:h-12 shrink-0 sm:items-center sm:justify-between border-b bg-card/80 px-3 sm:px-4 py-2 sm:py-0 backdrop-blur gap-2 sm:gap-0">
        {/* 左侧：标题与保存状态 */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="输入创作主题…"
            className="w-full sm:w-80 truncate rounded-md border-0 bg-transparent px-1.5 sm:px-2 py-1 text-xs sm:text-sm font-semibold text-foreground focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
          />

          {saving && (
            <span className="text-[10px] sm:text-[11px] text-muted-foreground animate-pulse flex items-center gap-1 shrink-0">
              <Loader2 className="size-3 animate-spin" /> <span className="hidden sm:inline">保存中…</span>
            </span>
          )}
        </div>

        {/* 右侧：成果操作与新建 */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVariantsOpen(true)}
            disabled={!canvasContent.trim()}
            className="gap-1 sm:gap-1.5 rounded-md text-xs font-medium cursor-pointer h-7 sm:h-8 px-2 sm:px-3"
          >
            <Share2 className="size-3.5" />
            <span>多平台派生</span>
            {Object.keys(variants).length > 0 && (
              <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.2 text-[10px]">
                {Object.keys(variants).length}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuoteCardOpen(true)}
            disabled={!canvasContent.trim()}
            className="gap-1 sm:gap-1.5 rounded-md text-xs font-medium text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/10 cursor-pointer h-7 sm:h-8 px-2 sm:px-3"
            title="生成小红书/社交媒体金句图卡"
          >
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">金句图卡</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyWeChat}
            disabled={!canvasContent.trim()}
            className="gap-1 rounded-md text-xs font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 cursor-pointer h-7 sm:h-8 px-2 sm:px-3"
            title="复制符合微信公众号后台规范的内联排版富文本"
          >
            {wechatCopied ? <Check className="size-3.5" /> : <MessageSquare className="size-3.5" />}
            <span className="hidden sm:inline">{wechatCopied ? "已复制公众号富文本" : "公众号排版"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!canvasContent.trim()}
            className="gap-1 sm:gap-1.5 rounded-md text-xs cursor-pointer h-7 sm:h-8 px-2 sm:px-3"
            title="复制 Markdown 原文"
          >
            {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
            <span className="hidden sm:inline">{copied ? "已复制" : "Markdown"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSaveToKbPlatform("master");
              setSaveToKbOpen(true);
            }}
            disabled={!canvasContent.trim()}
            className="gap-1 sm:gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground cursor-pointer h-7 sm:h-8 px-2 sm:px-3"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">存知识库</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(true)}
            className="gap-1 sm:gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground cursor-pointer h-7 sm:h-8 px-2 sm:px-3"
            title="查看草稿历史快照与安全回滚"
          >
            <History className="size-3.5 text-amber-500" />
            <span>快照</span>
            {snapshots.length > 0 && (
              <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 text-[10px] font-mono">
                {snapshots.length}
              </span>
            )}
          </Button>

          <div className="h-4 w-px bg-border mx-0.5 sm:mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={onNewProject}
            className="gap-1 rounded-md text-xs text-muted-foreground hover:text-foreground cursor-pointer h-7 sm:h-8 px-2"
          >
            <Plus className="size-3.5" />
            <span>新建</span>
          </Button>
        </div>
      </header>

      {/* 演示模式提醒 */}
      {draftMock && <MockNotice />}

      {/* 主体工作台：左侧原料抽屉 + 中间画布 */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 左侧原料抽屉 */}
        <MaterialsSidebar
          project={project}
          claimSnapshot={project.claimSnapshot || null}
          materials={project.materials || []}
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
          onInsertText={handleInsertText}
        />

        {/* 中间主画布与编辑器 */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {/* 画布编辑区 */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
            <div className="mx-auto max-w-4xl space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 min-w-0 flex-1 pr-4">
                  <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium shrink-0", currentSkillMeta.color)}>
                    {currentSkillDisplayName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {currentSkillDesc}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                  {canvasContent.length} 字
                </span>
              </div>

              <MarkdownEditor
                content={canvasContent}
                onChange={onContentChange}
                placeholder={`以 ${currentSkillDisplayName} 的风格沉浸创作，或使用下方工具条一键成稿……`}
                minHeight="calc(100vh - 230px)"
              />
            </div>
          </div>

          {/* 底部创作工具坞（技能选择、文风声库、一键成稿） */}
          <div className="shrink-0 border-t bg-card/90 px-4 py-2.5 backdrop-blur shadow-xs">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
              {/* 左侧：技能与文风配置 */}
              <div className="flex items-center gap-3">
                {/* 目标创作技能 */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground">技能:</span>
                  <Select value={targetSkill} onValueChange={(v) => handleSkillChange(v as PlatformSkillId)}>
                    <SelectTrigger className="h-8 min-w-44 max-w-72 rounded-lg text-xs font-medium bg-background">
                      <div className="flex items-center gap-1.5 truncate">
                        {getSkillIcon(targetSkill)}
                        <span className="truncate">{currentSkillDisplayName}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {skillAgents.length > 0 ? (
                        skillAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.stage || agent.id} className="text-xs">
                            <div className="flex items-center gap-1.5">
                              {getSkillIcon(agent.stage)}
                              <span className="font-semibold">{agent.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        PLATFORM_SKILLS.map((skill) => (
                          <SelectItem key={skill.id} value={skill.id} className="text-xs">
                            <span className="font-semibold">{skill.name}</span>
                            <span className="ml-1.5 text-[10px] text-muted-foreground">({skill.badge})</span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* 文风声库 */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground">文风:</span>
                  <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
                    <SelectTrigger className="h-8 w-36 rounded-lg text-xs font-medium bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">默认标准</SelectItem>
                      {voices.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 右侧：一键成稿主按钮 */}
              <div className="flex items-center gap-2">
                <Button
                  size="default"
                  onClick={runDraft}
                  disabled={drafting}
                  className="gap-2 rounded-lg px-4 text-xs font-semibold shadow-xs"
                >
                  {drafting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      正在成稿中…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 text-primary-foreground" />
                      {canvasContent ? `以「${currentSkillDisplayName}」重新起草` : `以「${currentSkillDisplayName}」一键成稿`}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 派生多平台抽屉 */}
      <VariantsDrawer
        open={variantsOpen}
        onOpenChange={setVariantsOpen}
        projectId={project.id}
        canvasContent={canvasContent}
        variants={variants}
        onVariantsChange={(v) => onProjectUpdate({ ...project, variants: v })}
        onOpenSaveKb={(plat) => {
          setSaveToKbPlatform(plat);
          setSaveToKbOpen(true);
        }}
      />

      {/* 存入知识库对话框 */}
      <SaveToKbDialog
        open={saveToKbOpen}
        onOpenChange={setSaveToKbOpen}
        defaultTitle={project.title}
        masterContent={canvasContent}
        variants={variants}
        initialPlatform={saveToKbPlatform}
      />

      {/* 小红书/社交媒体金句图卡对话框 */}
      <QuoteCardDialog
        open={quoteCardOpen}
        onOpenChange={setQuoteCardOpen}
        initialQuote={
          canvasContent
            ? canvasContent.replace(/^[#>*_\-\s]+/gm, "").slice(0, 150)
            : project.selectedTopic?.hook || project.claimSnapshot?.claim || ""
        }
        sourceTitle={title || project.title}
        topicTitle={project.selectedTopic?.title || ""}
      />

      {/* AI 动态生成微信公众号 SVG 封面对话框 */}
      <AiCoverDialog
        open={coverOpen}
        onOpenChange={setCoverOpen}
        title={title || project.title}
        angle={project.selectedTopic?.angle || project.claimSnapshot?.claim || ""}
        hook={project.selectedTopic?.hook || ""}
        summary={canvasContent.slice(0, 200)}
        category="深度思考"
      />

      {/* 草稿历史快照与安全回滚对话框 */}
      <VersionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        snapshots={snapshots}
        onRestoreSnapshot={handleRestoreSnapshot}
        onDeleteSnapshot={handleDeleteSnapshot}
        onTakeSnapshot={() => handleSaveSnapshot(canvasContent, "manual")}
      />
    </div>
  );
}
