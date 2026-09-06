import { Info } from "lucide-react";

/**
 * 演示数据提示条：流水线工位在未配置模型（或检索不到素材）时可能返回 isMock 数据，
 * 必须向用户明示「这不是 AI 的真实产出」，避免占位内容被当成成果。
 */
export function MockNotice({ label = "当前为演示数据" }: { label?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {label}
        （未配置模型或知识库素材不足时返回的占位内容，请到「设置」配置模型端点与密钥、或补录相关笔记后重新生成）
      </span>
    </div>
  );
}
