import { MapPin, CalendarDays, Clock } from 'lucide-react'
import type { InvitationCard } from '@lto/cards'
import { GhostButton } from '../../../components/Button'
import { CardShell, type PromptHandler } from './CardRenderer'
import { Row } from './Row'

/**
 * 邀请函卡（含渠道选择）。对应 UI-02/05「日程与邀约」与 UI-01/06 的生成邀请函。
 *
 * 渠道按钮**逐个渲染、按 `enabled` 置灰**：方案 §8.3 决策四要求可点性由服务端下发。
 * 注意这里不用 `disabled` 属性来做「已发送」——真实实现里发送是要写 outbox 的副作用，
 * 必须带幂等键；本轮走脚本流，所以只把点击转成一次 prompt。
 */
export function InvitationCardView({
  card,
  onPrompt,
}: {
  card: InvitationCard
  onPrompt: PromptHandler
}) {
  const { event } = card

  return (
    <CardShell title={card.title}>
      <p className="text-15 font-semibold text-ink">{event.title}</p>

      <dl className="mt-2.5 flex flex-col gap-1.5">
        <Row icon={<CalendarDays className="size-3.5 text-primary" strokeWidth={1.9} />}>
          {event.date}
        </Row>
        <Row icon={<Clock className="size-3.5 text-primary" strokeWidth={1.9} />}>{event.time}</Row>
        <Row icon={<MapPin className="size-3.5 text-primary" strokeWidth={1.9} />}>
          {event.restaurant}
          <span className="text-ink-3"> · {event.address}</span>
        </Row>
      </dl>

      <div className="mt-3.5 flex gap-2">
        {card.channels.map((ch) => (
          <GhostButton
            key={ch.id}
            disabled={!ch.enabled}
            onClick={() => onPrompt(`用${ch.label}发出邀请`)}
          >
            {ch.label}
          </GhostButton>
        ))}
      </div>
    </CardShell>
  )
}
