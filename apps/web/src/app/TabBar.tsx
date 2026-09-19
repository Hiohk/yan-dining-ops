import { Package, Smile, UserRound, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../lib/cn'

/**
 * 底部 Tab 栏。UI-01 实测：净高 48px、顶部 1px 分隔线，
 * 选中态为品牌绿图标 + 绿标签，未选中为灰。
 * 图标与文案与 UI-01 首页底部逐字对齐：AI 助理 / 餐务 / 技能 / 我的。
 *
 * 四个 tab 并非等分整屏：实测中心间距 91pt，而 390/4 = 97.5pt，
 * 反推内容区左右各内缩 14pt（4×90.5 = 362 = 390 − 2×14）。图标实测宽 20pt。
 */
interface TabDef {
  to: string
  label: string
  icon: LucideIcon
}

const TABS: TabDef[] = [
  { to: '/', label: 'AI 助理', icon: Smile },
  { to: '/tasks', label: '餐务', icon: UtensilsCrossed },
  { to: '/skills', label: '技能', icon: Package },
  { to: '/me', label: '我的', icon: UserRound },
]

export function TabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[var(--lto-app-max)] bg-surface shadow-[var(--lto-shadow-tabbar)] pb-safe"
      aria-label="主导航"
    >
      <ul className="flex h-[var(--lto-tabbar-h)] items-stretch px-3.5">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-0.5',
                  isActive ? 'text-primary' : 'text-ink-3',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-5" strokeWidth={isActive ? 2.1 : 1.7} />
                  <span className="text-[10px] leading-none">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
