import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

/**
 * 主按钮。UI-01 邀请函页实测：整宽、全圆角、品牌绿实底、白色 17px 文字。
 * 高度 48px —— 设计稿 1526/… 换算后与 iOS 44pt 最小可点区一致。
 */
export function PrimaryButton({
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...rest}
      className={cn(
        'h-12 w-full rounded-pill bg-primary text-17 font-semibold text-on-primary',
        'transition-colors active:bg-primary-press',
        'disabled:bg-line-strong disabled:text-white/70 disabled:active:bg-line-strong',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** 次要按钮：白底 + 浅描边，用于「换一批」「查看详情」这类并列动作 */
export function GhostButton({
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...rest}
      className={cn(
        'h-12 w-full rounded-pill border border-line bg-surface text-15 font-medium text-ink-1',
        'transition-colors active:bg-sunken',
        'disabled:text-ink-3',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** 快捷回复 chip：点了等于把 label 当用户输入发出去 */
export function Chip({
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...rest}
      className={cn(
        'h-8 shrink-0 whitespace-nowrap rounded-pill border border-line bg-surface px-3.5 text-13 text-ink-1',
        'transition-colors active:bg-sunken',
        className,
      )}
    >
      {children}
    </button>
  )
}
