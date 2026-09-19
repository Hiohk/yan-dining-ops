import type { ReactNode } from 'react'

/**
 * 卡片里的「图标 + 文本」信息行。
 *
 * 从 `InvitationCardView` 提出来的：用餐计划卡（`PlanSummaryCardView`）要用同一套行式排版，
 * 而两处各写一遍必然漂 —— 图标尺寸/基线偏移/换行行为都是 13pt 正文下逐点调过的值。
 *
 * `mt-0.5` 不是随手加的：lucide 图标的字形盒比视觉重心偏高，不推这半格，
 * 图标会看着比文字「浮起来一点」。字号或图标尺寸变了，这半格要重新看。
 */
export function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-13 text-ink-1">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}
