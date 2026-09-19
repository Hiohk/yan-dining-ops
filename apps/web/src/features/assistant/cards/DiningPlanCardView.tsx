import { Check } from 'lucide-react'
import type { DiningPlanCard } from '@lto/cards'
import { PrimaryButton } from '../../../components/Button'
import { CardActions, CardShell, type PromptHandler } from './CardRenderer'

/**
 * 用餐方案确认卡 —— 包间锁定前的**副作用闸门**（技术方案 §8.4）。
 *
 * 确认按钮点下去会触发真实副作用（锁包间、提申请、建日程），所以在真实实现里
 * 这个动作必须带服务端生成的幂等键。本轮的 `onPrompt` 走的是脚本流，
 * 接后端时这里要换成 `CardAction.kind === 'confirm'` + `idempotencyKey`
 * —— 注意**不能用前端生成的随机 UUID**，否则「刷新后重试」会重复锁包间。
 *
 * `total` 直接用服务端下发的值，前端**不重算**：技术方案红线一要求金额由代码按配置费率算，
 * 且只由服务端算。前端再乘一遍就会多出第二个真相，两边费率不一致时对不上账。
 */
export function DiningPlanCardView({
  card,
  onPrompt,
}: {
  card: DiningPlanCard
  onPrompt: PromptHandler
}) {
  const { plan } = card

  const rows: Array<[string, string, boolean?]> = [
    ['日期', plan.date],
    ['时段', plan.timeRange],
    ['餐厅', plan.restaurant],
    ['包间', plan.room],
    ['人数', `${plan.people} 人`],
    ['餐标', `¥${plan.perCapita}/人`],
    ['合计', `¥${plan.total.toLocaleString('zh-CN')}`, true],
  ]

  return (
    <CardShell title={card.title} badge={card.badge}>
      <dl className="flex flex-col gap-2">
        {rows.map(([label, value, emphasize]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-13 text-ink-2">{label}</dt>
            <dd
              className={
                emphasize
                  ? 'min-w-0 truncate text-17 font-bold text-primary'
                  : 'min-w-0 truncate text-13 text-ink-1'
              }
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {card.autoNext.length ? (
        <div className="mt-3.5 rounded-xl bg-primary-tint p-3">
          <p className="text-12 font-medium text-primary-deep">确认后将自动执行</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {card.autoNext.map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-12 text-ink-2">
                <Check className="size-3 shrink-0 text-primary" strokeWidth={2.6} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 主按钮与 chip 是同一套 action 渲染，避免出现「两边都能确认」的歧义 */}
      {card.actions?.length ? (
        <PrimaryButton className="mt-3.5" onClick={() => onPrompt(card.actions![0].label)}>
          {card.actions[0].label}
        </PrimaryButton>
      ) : (
        <CardActions actions={card.actions} onPrompt={onPrompt} className="mt-3" />
      )}
    </CardShell>
  )
}
