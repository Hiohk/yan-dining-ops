import { ChevronDown, Navigation, Search, Users, Wallet, CalendarDays, DoorOpen } from 'lucide-react'
import rest1 from '../../assets/rest-1.png'
import rest2 from '../../assets/rest-2.png'
import rest3 from '../../assets/rest-3.png'
import { ScreenShell } from '../../app/AppShell'
import { NavBar } from '../../app/NavBar'
import { RestaurantCard } from '../../components/RestaurantCard'
import { RESTAURANTS, RESTAURANT_FILTERS } from '../../lib/mock'

/**
 * UI-01 第 4 屏：找餐厅。
 *
 * 距离与人均都来自工具的结构化返回值（模型只负责把它们讲成人话），
 * 所以这里直接渲染字段，不做任何计算或推断 —— 这是「模型不产生数字」的落地方式。
 *
 * 本屏左右留白实测 8.9pt（卡片 x 8.9..379.2），**不到首页 21.6pt 的一半** ——
 * UI-01 各屏边距并不统一，见 tokens.css 里那份逐屏实测清单。所以这里用
 * --lto-page-x-wide，不要"顺手统一"成 --lto-page-x：统一了筛选行就会溢出。
 */

const PHOTOS = [rest1, rest2, rest3] as const

const FILTER_ICON = [CalendarDays, Users, Wallet, DoorOpen] as const

export function RestaurantSearchPage() {
  return (
    <ScreenShell>
      <NavBar title="找餐厅" />

      {/* 搜索条。实测搜索框高 33.8pt（不是 36）、定位按钮同高；两者间距 10。
          本屏导航栏高 56 与搜索框齐平（导航栏底 93.4 / 搜索框顶 92.8），所以不加上边距。 */}
      <div className="flex items-center gap-2.5 px-page-wide">
        <div className="flex h-8.5 flex-1 items-center gap-2.5 rounded-xl bg-surface px-3 shadow-card">
          <Search className="size-[18px] shrink-0 text-ink-3" strokeWidth={1.9} />
          <input
            placeholder="搜索商圈、菜系、标准…"
            aria-label="搜索餐厅"
            className="min-w-0 flex-1 bg-transparent text-14 text-ink-1 outline-none placeholder:text-ink-3"
          />
        </div>
        <button
          aria-label="定位当前位置"
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface shadow-card transition-colors active:bg-sunken"
        >
          <Navigation className="size-[18px] text-ink" strokeWidth={1.9} />
        </button>
      </div>

      {/* 筛选。实测高 34.7、四个各宽 82.5~88.2、间距 7.45、左起 8.4，**整行止于 372.2**
          —— 比卡片的右缘（379.2）短 7pt，说明这一行是**内容撑开**的，不是等分容器：
          写成 grid-cols-4 会强行拉成各 87.5 并把行尾顶到 381，第四个 pill 就差出 8pt。
          内容宽度对得上：图标 14 + 间距 4 + 「日期」26 + 间距 4 + chevron 14 + px-3×2 = 86。
          标签文字「日期」墨宽 26.3（两字）⇒ 13px，图标墨宽 11.8 ⇒ 14px。 */}
      <div className="mt-2 flex gap-1.75 px-page-wide">
        {RESTAURANT_FILTERS.map((label, i) => {
          const Icon = FILTER_ICON[i]
          return (
            <button
              key={label}
              className="flex h-8.5 items-center justify-center gap-1 rounded-xl bg-surface px-3 text-13 text-ink-1 transition-colors active:bg-sunken"
            >
              <Icon className="size-3.5 shrink-0 text-icon-ink" strokeWidth={1.8} />
              <span className="truncate">{label}</span>
              <ChevronDown className="size-3.5 shrink-0 text-ink-3" strokeWidth={2} />
            </button>
          )
        })}
      </div>

      {/* 筛选行底 → 卡 1 顶 实测 7.5（169.2 → 176.7） */}
      <div className="flex flex-col gap-y-(--lto-gap-y) px-page-wide pt-2">
        {RESTAURANTS.map((r, i) => (
          <RestaurantCard key={r.id} data={r} photo={PHOTOS[i % PHOTOS.length]} />
        ))}
      </div>
    </ScreenShell>
  )
}

/* 餐厅卡已抽成共享组件（apps/web/src/components/RestaurantCard.tsx）：
   对话内的餐厅推荐卡要复用同一张卡，否则两处各写一遍必然视觉漂移。
   那份实测注释（照片 146.2×140.6、正文 11px、价格 20px 等）随组件一起搬走了。 */
