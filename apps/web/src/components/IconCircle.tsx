import type { LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'

/**
 * 图标底圆。底色 #eef8ee、图标为品牌绿描边。
 * 首页快捷入口、餐务卡标题、技能卡图标全部复用这一个组件。
 *
 * 尺寸按屏实测，并不统一，因此支持直接传数值：
 *   首页快捷入口 39.3pt（→ 40）、餐务卡标题 39pt、技能瓦片 32pt。
 * 图标字形约为底圆直径的 0.53，与设计稿的留白比例一致。
 *
 * **字形颜色按屏分两档**（对 UI-01 做颜色直方图取众数得到，不是目测）：
 *   首页快捷入口、餐务卡图标 = #62a966 品牌绿
 *   技能瓦片、找餐厅筛选   = #102b1f 墨绿
 * 默认取品牌绿（占多数），墨绿那两处显式传 iconClassName="text-icon-ink"。
 */
const PRESET = { sm: 32, md: 38, lg: 44 } as const

export function IconCircle({
  icon: Icon,
  size = 'md',
  tone = 'soft',
  className,
  iconClassName,
}: {
  icon: LucideIcon
  /** sm=32  md=38  lg=44，也可直接传像素数 */
  size?: keyof typeof PRESET | number
  tone?: 'soft' | 'white'
  className?: string
  /** 字形颜色。默认品牌绿；技能瓦片这类墨绿图标传 text-icon-ink */
  iconClassName?: string
}) {
  const px = typeof size === 'number' ? size : PRESET[size]
  const glyph = Math.round(px * 0.53)
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full',
        tone === 'soft' ? 'bg-primary-soft' : 'bg-surface',
        className,
      )}
      style={{ width: px, height: px }}
    >
      {/* 互斥取值，不是叠加：项目里的 cn 只是字符串拼接（没有 tailwind-merge），
          写成 cn('text-primary', iconClassName) 会两个类同时生效，
          谁赢取决于 CSS 里的先后顺序 —— 那样改一次构建就可能翻车。 */}
      <Icon
        className={iconClassName ?? 'text-primary'}
        strokeWidth={1.8}
        style={{ width: glyph, height: glyph }}
      />
    </span>
  )
}
