/**
 * 墨匠剪藏品牌标识 —— 「点墨成章」
 * 与主站点 logo 完全一致：圆角方印 + 负空间墨滴 + 底部墨条。
 * 弹窗固定浅色背景，直接使用 #171717 / #ffffff 双色渲染，矢量缩放无损。
 */
export function InkCraftMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="墨匠 InkCraft"
      style={{ display: "block" }}
    >
      <rect width="32" height="32" rx="7.2" fill="#171717" />
      <path
        d="M16 4.6C17.7 9.1 21.9 11.6 21.9 16.9A5.9 5.9 0 1 1 10.1 16.9C10.1 11.6 14.3 9.1 16 4.6Z"
        fill="#ffffff"
      />
      <rect x="8.2" y="25.5" width="15.6" height="3" rx="1.5" fill="#ffffff" />
    </svg>
  );
}