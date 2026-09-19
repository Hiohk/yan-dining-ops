import { cn } from '../lib/cn'

export type BadgeTone = 'neutral' | 'warn' | 'info' | 'success' | 'danger'

/**
 * 状态徽标。UI-01 餐务页实测：「待确认」#fff2df/#b7791f、「报销中」#e8f2fd/#0983c9。
 * 圆角是 8px 而非全圆——设计稿的徽标是圆角矩形，这点容易被写成 pill。
 *
 * 尺寸实测（UI-01/03.png「待确认」）：色块 56.3 × 26.2pt，三字文字宽 32.8pt
 * ⇒ 左右内边距 (56.3 − 32.8) / 2 = 11.75 ≈ 12px，上下 16px 行高 + 5px × 2 = 26。
 * 原先的 py-[3px] 只有 22pt 高，比设计稿矮 4pt，站在卡片里显得发飘。
 */
const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-ink-2',
  warn: 'bg-warn-bg text-warn-fg',
  info: 'bg-info-bg text-info-fg',
  success: 'bg-ok-bg text-ok-fg',
  danger: 'bg-danger-bg text-danger-fg',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        // 行高由 text-2xs 的 --text-2xs--line-height（16px）提供，不必再写 leading-*
        'inline-flex shrink-0 items-center rounded-lg px-3 py-1.25 text-2xs font-medium',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
