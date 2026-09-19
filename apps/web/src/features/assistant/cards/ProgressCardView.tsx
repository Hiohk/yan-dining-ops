import { Check } from 'lucide-react'
import type { ProgressCard } from '@lto/cards'
import { cn } from '../../../lib/cn'
import { CardShell } from './CardRenderer'

/**
 * AI 进度卡 —— 对话里唯一的进度真相（技术方案约束 C3）。
 *
 * 这里**不判断任何业务状态**，只按 `steps[].status` 上色。
 * `done` / `total` 与 steps 都由后端从 MAIN_PATH 派生后下发；
 * 前端如果自己按 kind 或文案去推「现在应该走到第几步」，就会变成第二套真相 ——
 * 原型正是这么做的（task_service 里另写了一份 done_map），结果是显示与实际漂移。
 *
 * 布局：横向五步。每个 li 是等宽的 flex-1，连接线用「绝对定位 + right-1/2 + w-full」
 * 从本节点向左铺满到上一个节点中心，这样不需要算像素间距，步骤数变了也不用改。
 */

/** 节点直径 18px，线高 2px ⇒ 线顶 = 18/2 − 2/2 = 8px，即 top-2 */
const NODE = 'z-10 grid size-4.5 shrink-0 place-items-center rounded-full'

const LABEL: Record<'done' | 'current' | 'todo', string> = {
  done: 'text-ink-1',
  current: 'font-medium text-primary-deep',
  todo: 'text-ink-3',
}

export function ProgressCardView({ card }: { card: ProgressCard }) {
  return (
    <CardShell>
      <header className="flex items-baseline justify-between gap-2">
        <span className="text-13 font-medium text-ink-1">AI 进度</span>
        <span className="text-12 tabular-nums text-ink-2">
          {card.done}/{card.total}
        </span>
      </header>

      <ol className="mt-3 flex items-start">
        {card.steps.map((step, i) => (
          <li key={step.label} className="relative flex flex-1 flex-col items-center gap-1.5">
            {/* 连接线：只在第 2 步起画，颜色取决于**上一段**是否已完成 */}
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  'absolute top-2 right-1/2 h-0.5 w-full',
                  card.steps[i - 1].status === 'done' ? 'bg-primary' : 'bg-line-strong',
                )}
              />
            ) : null}

            {step.status === 'done' ? (
              <span className={cn(NODE, 'bg-primary')}>
                <Check className="size-3 text-on-primary" strokeWidth={3.2} />
              </span>
            ) : step.status === 'current' ? (
              <span className={cn(NODE, 'border-2 border-primary bg-surface')}>
                <span className="size-2 rounded-full bg-primary" />
              </span>
            ) : (
              <span className={cn(NODE, 'bg-line-strong')} />
            )}

            <span className={cn('text-center text-2xs leading-tight', LABEL[step.status])}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {card.note ? <p className="mt-2.5 text-2xs text-ink-2">{card.note}</p> : null}
    </CardShell>
  )
}
