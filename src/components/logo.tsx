/**
 * 墨匠 InkCraft 品牌标识 —— 「点墨成章」
 *
 * 圆角方印：匠人雕琢与内容块的双重隐喻；
 * 负空间墨滴：一滴想法落于纸上；
 * 底部墨条：墨凝成线、成块、成文章。
 *
 * 纯单色体系：印章取 currentColor，墨滴与墨条取 var(--background)，
 * 明暗模式自动反色，无需额外配置。
 */
export function InkCraftMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="墨匠 InkCraft"
    >
      <rect width="32" height="32" rx="7.2" fill="currentColor" />
      <path
        d="M16 4.6C17.7 9.1 21.9 11.6 21.9 16.9A5.9 5.9 0 1 1 10.1 16.9C10.1 11.6 14.3 9.1 16 4.6Z"
        fill="var(--background)"
      />
      <rect
        x="8.2"
        y="25.5"
        width="15.6"
        height="3"
        rx="1.5"
        fill="var(--background)"
      />
    </svg>
  );
}
