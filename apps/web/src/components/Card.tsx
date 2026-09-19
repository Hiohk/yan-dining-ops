import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

/**
 * 基础卡片。UI-01 实测：白底、圆角 18px、阴影仅 5% 不透明度。
 * 所有列表项、区块都用它，避免各处自己写阴影导致视觉漂移。
 */
export function Card({
  children,
  className,
  as: Tag = 'div',
  onClick,
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'button'
  onClick?: () => void
}) {
  return (
    <Tag
      className={cn(
        'bg-surface rounded-card shadow-card',
        Tag === 'button' && 'w-full text-left active:scale-[0.995] transition-transform',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </Tag>
  )
}
