import { cn } from "@/lib/utils";

const STAGE_TINTS: Record<string, string> = {
  ideate: "tint-ideate",
  topic: "tint-ideate",
  evidence: "tint-ideate",
  draft: "tint-draft",
  review: "tint-review",
  completed: "tint-completed",
};

const STAGE_LABELS: Record<string, string> = {
  ideate: "01 构思",
  topic: "01 构思",
  evidence: "01 构思",
  draft: "02 起草",
  review: "03 编审分发",
  completed: "已完成",
};

export function stageTint(stage: string): string {
  return STAGE_TINTS[stage] || "tint-topic";
}

/** 流水线阶段徽章：低饱和功能色，扫读时一眼区分四个工位 */
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
