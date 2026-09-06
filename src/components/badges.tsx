import { cn } from "@/lib/utils";

/** 项目阶段徽章（成果页 / 全局搜索用） */
const STAGE_TINTS: Record<string, string> = {
  ideate: "tint-ideate",
  topic: "tint-ideate",
  gather: "tint-ideate",
  draft: "tint-draft",
  review: "tint-review",
  completed: "tint-completed",
};

const STAGE_LABELS: Record<string, string> = {
  ideate: "01 选题",
  topic: "02 锁题",
  gather: "03 取证",
  draft: "04 起草",
  review: "05 核稿 · 分发",
  completed: "已完成",
};

/** 编辑部工位徽章：custom_agents.stage（与项目阶段键位含义不同，独立映射） */
const AGENT_STAGE_TINTS: Record<string, string> = {
  wechat: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  xiaohongshu: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
  zhihu: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
  x_thread: "text-zinc-800 dark:text-zinc-200 bg-zinc-500/10 border-zinc-500/20",
  master: "text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20",
  image_gen: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
  topic: "tint-ideate",
  brief: "tint-ideate",
  evidence: "tint-ideate",
  draft: "tint-draft",
  review: "tint-review",
  extract: "tint-master",
};

const AGENT_STAGE_LABELS: Record<string, string> = {
  wechat: "微信公众号 · 主笔",
  xiaohongshu: "小红书笔记 · 创作",
  zhihu: "知乎回答 · 答主",
  x_thread: "X / 即刻 · 推手",
  master: "通用母稿 · 主笔",
  image_gen: "文生图 · 视觉配图",
  topic: "01 选题策划",
  brief: "02 锁题定调",
  evidence: "03 取证装箱",
  draft: "04 初稿起草",
  review: "05 核稿审查",
  extract: "06 卡片萃取",
};

export function stageTint(stage: string): string {
  return STAGE_TINTS[stage] || "tint-topic";
}

/** 流水线阶段徽章：低饱和功能色，扫读时一眼区分工位 */
export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  return (
    <span
      className={cn(
        "tint-badge inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] font-medium leading-4",
        stageTint(stage),
        className
      )}
    >
      {STAGE_LABELS[stage] || stage}
    </span>
  );
}

/** 编辑部工位徽章 */
export function AgentStageBadge({ stage, className }: { stage: string; className?: string }) {
  const isCustom = stage?.startsWith("custom_") || !AGENT_STAGE_LABELS[stage];
  const label = isCustom ? "自定义技能" : AGENT_STAGE_LABELS[stage];
  const tint = isCustom
    ? "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20"
    : AGENT_STAGE_TINTS[stage] || "tint-ideate";

  return (
    <span
      className={cn(
        "tint-badge inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] font-medium leading-4",
        tint,
        className
      )}
    >
      {label}
    </span>
  );
}

const PLATFORM_TINTS: Record<string, string> = {
  wechat: "tint-wechat",
  微信公众号: "tint-wechat",
  xiaohongshu: "tint-xiaohongshu",
  小红书: "tint-xiaohongshu",
  zhihu: "tint-zhihu",
  知乎: "tint-zhihu",
  x_thread: "tint-x_thread",
  "X Thread": "tint-x_thread",
  master: "tint-master",
};

export function platformTint(platform: string): string {
  return PLATFORM_TINTS[platform] || "tint-master";
}

/** 分发平台徽章：按平台品牌色相的低饱和版本 */
export function PlatformBadge({
  platform,
  label,
  className,
}: {
  platform: string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tint-badge inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] font-normal leading-4",
        platformTint(platform),
        className
      )}
    >
      {label || platform}
    </span>
  );
}
