import {
  ArrowUpRight,
  CalendarCheck,
  CalendarPlus,
  Clock,
  ConciergeBell,
  Contact,
  FileText,
  Grid2x2,
  JapaneseYen,
  Mail,
  QrCode,
  ReceiptText,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import mascot from '../../assets/mascot-skills.png'
import { AppShell } from '../../app/AppShell'
import { PageHeader } from '../../app/NavBar'
import { Card } from '../../components/Card'
import { IconCircle } from '../../components/IconCircle'
import { SKILL_GROUPS, type SkillGroup } from '../../lib/mock'
import { cn } from '../../lib/cn'

/**
 * UI-01 第 5 屏：技能中心。
 *
 * 「技能」与「工具」是两件事：技能是用户视角的入口，工具是模型能调的函数。
 * 两者是多对多 —— 一个技能可能触发多个工具，一个工具也可能被多个技能复用。
 * 所以技能条目上不挂 handler，只带一个 key，由后端的技能路由表决定行为。
 */

const SKILL_ICON: Record<string, LucideIcon> = {
  'find-restaurant': ConciergeBell,
  'check-availability': CalendarCheck,
  'create-schedule': CalendarPlus,
  'make-invitation': Mail,
  'order-helper': ReceiptText,
  'allergen-alert': Sparkles,
  'budget-calc': Grid2x2,
  'invoice-ocr': ReceiptText,
  'submit-claim': ArrowUpRight,
  'claim-status': Clock,
  'meal-standard': JapaneseYen,
  policy: FileText,
  'invoice-info': QrCode,
  contact: Contact,
}

export function SkillsPage() {
  return (
    <AppShell>
      <PageHeader title="技能" />

      <section className="px-page-tab">
        {/*
          banner 实测（UI-01/05.png）：高 136.9pt；标题文字顶距 banner 顶 34pt
          （22pt 字在 32pt 行框内下移约 8pt，故 padding-top 取 26pt）；
          吉祥物宽 160pt ≈ banner 宽的 46%，顶距 19pt，右侧贴边且底部被裁。
        */}
        <div className="relative h-[137px] overflow-hidden rounded-xl bg-[linear-gradient(135deg,#eaf6ea_0%,#f2faf3_55%,#e4f2e6_100%)] px-6 pt-[26px]">
          <h2 className="relative z-10 text-[22px] font-bold leading-8 text-ink">
            常用技能，一键调用
          </h2>
          <p className="relative z-10 mt-1 text-13 text-ink-2">让企业用餐更简单</p>
          <img
            src={mascot}
            alt=""
            className="pointer-events-none absolute right-0 top-[19px] w-[46%] max-w-[200px] select-none"
            draggable={false}
          />
        </div>
      </section>

      {/* 分组卡间距实测 22.0pt。不能用 --lto-gap-y（那是首页瓦片栅格的 12）。 */}
      <div className="flex flex-col gap-y-5.5 px-page-tab pt-3.5">
        {SKILL_GROUPS.map((group) => (
          <SkillSection key={group.key} group={group} />
        ))}
      </div>
    </AppShell>
  )
}

/**
 * 分组卡。全部实测自 UI-01/05.png（本屏左右留白 15.0pt，卡 x 15..375，卡间距 22.0）：
 *   分组标题「餐前」墨高 18.8、墨宽 37.5（两字）⇒ **20px**，不是 text-17（那会是 15.5）
 *   三列竖排瓦片：高 85、图标底圆 Ø39.4、圆→文字 8.75、文字 text-14
 *   两列横排瓦片：高 58、图标底圆 Ø38、左内边距 12.3、圆→文字 12、文字 text-15
 *     行间距 17（实测两行文字节距 75.0 = 58 + 17）
 *   标题行→瓦片 16；卡片内边距 16
 *   **瓦片底色是白的**，与卡片同为 #ffffff，只靠一道极轻的阴影分开。
 *     原先写 bg-sunken（#f2f6f3）是明显的灰绿，整屏因此发闷。
 */
function SkillSection({ group }: { group: SkillGroup }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <UtensilsCrossed className="size-4 shrink-0 text-icon-ink" strokeWidth={1.9} />
        <h3 className="text-20 font-semibold text-ink">{group.title}</h3>
        {group.hint ? <p className="ml-auto text-13 text-ink-3">{group.hint}</p> : null}
      </div>

      {/* 标题行→瓦片的间距**按列数分档**（两列 10.3 / 三列 14.25），这是实测差异，
          不是笔误：竖排瓦片上方留白更多。行间距同理，两列是 18。 */}
      <div
        className={cn(
          'grid',
          group.columns === 2
            ? 'mt-2.5 grid-cols-2 gap-x-2.5 gap-y-4.5'
            : 'mt-3.5 grid-cols-3 gap-2.5',
        )}
      >
        {group.items.map((item) => {
          const Icon = SKILL_ICON[item.key] ?? Sparkles
          return group.columns === 2 ? (
            <button
              key={item.key}
              className="flex h-[58px] items-center gap-3 rounded-xl bg-surface pl-3 pr-2 text-left shadow-card transition-colors active:bg-primary-tint"
            >
              <IconCircle icon={Icon} size={38} iconClassName="text-icon-ink" />
              <span className="text-15 font-medium text-ink">{item.label}</span>
            </button>
          ) : (
            <button
              key={item.key}
              className="flex h-21.25 flex-col items-center justify-center gap-2.25 rounded-xl bg-surface shadow-card transition-colors active:bg-primary-tint"
            >
              <IconCircle icon={Icon} size={39} iconClassName="text-icon-ink" />
              <span className="text-14 font-medium text-ink">{item.label}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
