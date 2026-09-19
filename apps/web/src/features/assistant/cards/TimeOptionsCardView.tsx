import { useState } from 'react'
import type { TimeOptionsCard } from '@lto/cards'
import { cn } from '../../../lib/cn'
import { CardActions, CardShell, type PromptHandler } from './CardRenderer'

/**
 * 候选时间卡。取自 UI-02/02 屏（该屏还有任务上下文条与「确认时间，接着挑餐厅」主按钮，
 * 本轮先落地时间候选本身）。
 *
 * 选中态是**本地 UI 状态**：它只表示「用户正在看哪一个」，
 * 真正的时间确认要等用户点下去、由服务端落库后才成立。
 * 所以这里允许本地高亮，但**不把 selected 回写成业务状态** ——
 * 协议里的 `option.selected` 是服务端下发的既定事实，两者不要混。
 *
 * `unavailable` 的选项显式置灰并禁止点击：方案 §8.3 决策四要求
 * 可点性由服务端下发，前端不自行推断「有没有冲突」。
 */
export function TimeOptionsCardView({
  card,
  onPrompt,
}: {
  card: TimeOptionsCard
  onPrompt: PromptHandler
}) {
  const [picked, setPicked] = useState<string | null>(
    card.options.find((o) => o.selected)?.id ?? null,
  )

  return (
    <CardShell title={card.title} badge={card.badge}>
      <div className="flex flex-col gap-2">
        {card.options.map((opt) => {
          const isPicked = picked === opt.id

          return (
            <button
              key={opt.id}
              type="button"
              disabled={opt.unavailable}
              onClick={() => {
                setPicked(opt.id)
                onPrompt(opt.label)
              }}
              className={cn(
                'flex h-11 items-center justify-between gap-2 rounded-xl px-3.5 text-15 transition-colors',
                // 三种态互斥取值。cn() 没有 tailwind-merge，写成叠加会两个类同时生效，
                // 谁赢取决于 CSS 源顺序 —— 那就会「改一次构建翻一次车」。
                opt.unavailable && 'bg-sunken text-ink-3',
                !opt.unavailable && isPicked && 'border border-primary bg-surface font-semibold text-primary-deep',
                !opt.unavailable && !isPicked && 'bg-primary-tint text-ink-1 active:bg-primary-soft',
              )}
            >
              <span className="truncate">{opt.label}</span>
              {opt.hint ? (
                <span
                  className={cn(
                    'shrink-0 text-13',
                    opt.unavailable ? 'text-warn-fg' : 'text-primary-deep',
                  )}
                >
                  {opt.hint}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <CardActions actions={card.actions} onPrompt={onPrompt} className="mt-3" />
    </CardShell>
  )
}
