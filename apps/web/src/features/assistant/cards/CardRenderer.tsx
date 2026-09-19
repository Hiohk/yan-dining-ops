import { isKnownCard, type AnyCard, type CardAction, type CardBase } from '@lto/cards'
import type { ReactNode } from 'react'
import { Badge } from '../../../components/Badge'
import { Chip } from '../../../components/Button'
import { cn } from '../../../lib/cn'
import { DiningPlanCardView } from './DiningPlanCardView'
import { InvitationCardView } from './InvitationCardView'
import { PlanSummaryCardView } from './PlanSummaryCardView'
import { ProgressCardView } from './ProgressCardView'
import { RestaurantOptionsCardView } from './RestaurantOptionsCardView'
import { TimeOptionsCardView } from './TimeOptionsCardView'

/**
 * 卡片渲染分发。协议类型来自 @lto/cards，这里只负责「把类型映射到视图」。
 *
 * 渲染器放在 apps/web 而不是 packages/cards：后者当前**没有 React 依赖**
 * （package.json 里只有 typescript），只存协议类型。技术方案 §10.3 设想的是
 * `packages/cards/src/registry.tsx`，等后端卡片管线落地、该包引入 React 后再上移 ——
 * 协议类型本身不受影响，这次只是先让渲染跑通。
 *
 * **降级是硬要求**（方案 §8.3 决策三）：未知 kind 或协议版本越界时，
 * 渲染 title + payload 文本化 + **完整 actions**，而不是白屏、也不是丢弃。
 * 原型的「暂不支持的卡片类型」直接丢掉 actions，用户就没法操作了。
 */

export type PromptHandler = (text: string) => void

export function CardRenderer({ card, onPrompt }: { card: AnyCard; onPrompt: PromptHandler }) {
  return <div data-card-kind={card.kind}>{renderCard(card, onPrompt)}</div>
}

/**
 * 外面那层 `data-card-kind` 是**给端到端验证用的**，不影响渲染：
 * 每个 kind 的视图都返回单个 block（`CardShell` 或 `RestaurantOptionsCardView`
 * 自己的那个 flex 列），外面再包一层 block，几何与包之前逐点相同 ——
 * 内层都是撑满宽度的 block，父级 flex 列的 `gap` 也照旧。
 *
 * 加它的理由很实际：在此之前，验证脚本判断「这一轮出的是哪种卡」只能靠
 * 看按钮文字（`AI推荐` / `确认方案` / `邀请函`）猜，而 `time_options` 卡
 * **根本没有可认的文案** —— 标题由模型自由发挥。有了这个属性，
 * 「该出时间卡的时候出没出时间卡」才是一句可断言的话。
 */
function renderCard(card: AnyCard, onPrompt: PromptHandler) {
  if (!isKnownCard(card)) return <FallbackCard card={card} onPrompt={onPrompt} />

  switch (card.kind) {
    case 'progress':
      return <ProgressCardView card={card} />
    case 'time_options':
      return <TimeOptionsCardView card={card} onPrompt={onPrompt} />
    case 'restaurant_options':
      return <RestaurantOptionsCardView card={card} onPrompt={onPrompt} />
    case 'dining_plan':
      return <DiningPlanCardView card={card} onPrompt={onPrompt} />
    case 'invitation':
      return <InvitationCardView card={card} onPrompt={onPrompt} />
    // 终态卡：**不传 onPrompt** —— 分享是纯前端动作，不回给模型。
    // 传了就等于给这张卡留一个「还能继续聊」的假接口（见该视图的注释 ②）。
    case 'plan_summary':
      return <PlanSummaryCardView card={card} />
    default:
      // 协议里新增了 kind 但这里还没接视图 —— 同样降级，不白屏
      return <FallbackCard card={card} onPrompt={onPrompt} />
  }
}

/** 卡片外壳：白底、圆角、轻阴影，可选标题行（标题 + 状态徽标） */
export function CardShell({
  title,
  badge,
  children,
  className,
}: {
  title?: string
  badge?: CardBase['badge']
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-card bg-surface p-3.5 shadow-card', className)}>
      {title || badge ? (
        <header className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-15 font-semibold text-ink">{title}</h3>
          {badge ? <Badge tone={badge.tone}>{badge.text}</Badge> : null}
        </header>
      ) : null}
      {children}
    </div>
  )
}

/**
 * 快捷回复 chip 组。协议里 `kind: "prompt"` 的语义就是
 * 「点一下 = 把 label 当作用户输入发出去」（方案 §8.3 决策一），
 * 所以这里不需要任何额外判断 —— 直接把 label 交给同一个 send 通道，
 * chip 与手动输入走完全相同的代码路径。
 */
export function CardActions({
  actions,
  onPrompt,
  className,
}: {
  actions?: CardAction[]
  onPrompt: PromptHandler
  className?: string
}) {
  if (!actions?.length) return null
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {actions.map((a) => (
        <Chip
          key={a.id}
          disabled={a.disabled}
          onClick={() => onPrompt(a.label)}
          className={cn(a.primary && 'border-primary bg-primary text-on-primary')}
        >
          {a.label}
        </Chip>
      ))}
    </div>
  )
}

/** 降级卡片：把 payload 摊成键值对，并**保留全部 actions** */
function FallbackCard({ card, onPrompt }: { card: AnyCard; onPrompt: PromptHandler }) {
  const meta = new Set(['v', 'id', 'kind', 'title', 'badge', 'actions', 'taskId'])
  // card 在这里可能是任意形状（未知协议版本），所以按普通对象遍历，不假设字段
  const entries = Object.entries(card as unknown as Record<string, unknown>).filter(
    ([k, val]) => !meta.has(k) && val != null && typeof val !== 'object',
  )

  return (
    <CardShell
      title={card.title ?? `未知卡片 · ${card.kind}`}
      badge={{ text: `v${card.v}`, tone: 'neutral' }}
    >
      {entries.length ? (
        <dl className="flex flex-col gap-1">
          {entries.map(([k, val]) => (
            <div key={k} className="flex gap-2 text-2xs">
              <dt className="shrink-0 text-ink-3">{k}</dt>
              <dd className="min-w-0 flex-1 break-words text-ink-2">{String(val)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <CardActions actions={card.actions} onPrompt={onPrompt} className="mt-3" />
    </CardShell>
  )
}
