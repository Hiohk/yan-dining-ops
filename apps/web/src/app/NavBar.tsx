import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * 二级页导航栏。UI-01 实测：左侧 35pt 白色圆形返回键、标题绝对居中（不随左右内容偏移）。
 * 标题用绝对定位居中而非 flex 均分 —— 否则右侧有内容时标题会被推歪。
 *
 * 标题字号：02/04/06 三屏的标题墨迹宽度分别是 69.8 / 70.8 / 119.1，按每字 23.4 折算
 * 都是 **24px**（原先写的 text-xl=20px，每屏都矮一档）。
 */
export function NavBar({ title, right }: { title: string; right?: ReactNode }) {
  const navigate = useNavigate()

  return (
    <header className="relative flex h-14 items-center px-page">
      <button
        onClick={() => navigate(-1)}
        aria-label="返回"
        className="grid size-8.75 place-items-center rounded-full bg-surface shadow-card transition-colors active:bg-sunken"
      >
        <ChevronLeft className="size-5 text-ink" strokeWidth={2} />
      </button>

      <h1 className="pointer-events-none absolute inset-x-14 text-center text-24 font-semibold text-ink">
        {title}
      </h1>

      {right ? <div className="ml-auto">{right}</div> : null}
    </header>
  )
}

/** 一级页大标题（餐务 / 技能 / 我的）。UI-01 实测：24px、700、墨绿 */
export function PageHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="flex h-14 items-center px-page">
      <h1 className="text-24 font-bold tracking-tight text-ink">{title}</h1>
      {right ? <div className="ml-auto">{right}</div> : null}
    </header>
  )
}
