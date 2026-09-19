import { CalendarDays, Mail, MapPin, MessageSquare, PenLine, Square } from 'lucide-react'
import { useState } from 'react'
import leaf from '../../assets/leaf-invite.png'
import mascot from '../../assets/mascot-invite.png'
import { ScreenShell } from '../../app/AppShell'
import { NavBar } from '../../app/NavBar'
import { PrimaryButton } from '../../components/Button'
import { cn } from '../../lib/cn'
import {
  INVITATION_CHANNELS,
  INVITATION_DEMO as D,
  INVITATION_STYLES,
} from '../../lib/mock'

/**
 * UI-01 第 6 屏：生成邀请函。
 *
 * 邀请函是**制品（artifact）**，不是消息：它由任务产生、可版本化、可重复发送。
 * 因此这一屏读的是 task.artifacts["invitation"]，而不是对话上下文。
 * 「发送邀请」是副作用动作，必须先过确认闸门（后端校验 pending_step 后才执行）。
 *
 * 几何实测自 UI-01/06.png（本屏左右留白 9.4pt，与首页的 21.6pt 不同档）：
 *   邀请函卡片 x 9.4..380.6（宽 371.2）、y 101.3..606.5（高 505.2）
 *   样式行 y 632..700（高 68）、渠道行 y 710..780（高 68），行间距 10.3
 *   发送按钮 y 787..841.5（高 54.5），全圆角
 * 卡片底色是暖白 #faf9f6（不是纯白）—— 贺卡质感全靠这一点暖调，别改回 --lto-surface。
 *
 * 卡内文字全部按 UI-01/06.png 的**逐字形墨迹起点差**重测过（CJK 字距 = 1em，
 * 起点差可以直接当字号读，比量整行墨宽稳：整行会被抗锯齿撑大约 2%）：
 *   INVITATION   11.25px + 0.42em，墨宽 96.1 对 96.5
 *   大标题       起点差 37.7 ⇒ **38px**，墨高 37.0 对 37.0（原 28px 只有 26.5，小 23%）
 *   诚邀您的莅临  起点差 25.5、单字墨宽 17 ⇒ 20px + 0.28em（原 15px 只有 19.2）
 *   日期 / 餐厅名 数字起点差 9、整行 98.9 ⇒ **15px**（原 17px 整行 110.0，宽 11%）
 *   TOGETHER     整行 152.3 对 145.5、墨高 5.2 ⇒ **7.25px**（原先套 text-2xs 有 251pt，大了一倍）
 * 纵向节奏按墨迹位置反推（设计稿实测值 → 我修正后）：
 *   卡顶→INVITATION 墨顶 53.9 → 54.0        上分隔线 81.6 → 81.0
 *   大标题墨顶 114.8 → 115.0                诚邀墨顶 172.5 → 172.5
 *   日期行墨顶 230.6 → 231.0                餐厅名墨顶 265.3 → 265.0
 *   下分隔线 431.2 → 432.0                  卡高 505.2 → 505.5
 * 两根金色分隔线**一样长**，都是 27.7pt（w-7）；原来下面那根写成 w-14，长了一倍。
 */

const STYLE_ICON = [PenLine, Square, PenLine] as const

export function InvitationPage() {
  const [style, setStyle] = useState<string>('business')
  const [channel, setChannel] = useState<string>('email')

  return (
    <ScreenShell
      footer={<PrimaryButton className="h-13.5">发送邀请</PrimaryButton>}
      footerClassName="px-page-wide"
      className="pb-1"
    >
      <NavBar title="生成邀请函" />

      <section className="px-page-wide pt-1">
        <div className="relative aspect-371/505 overflow-hidden rounded-xl bg-[#faf9f6] shadow-card">
          {/*
            金色弧线。原先写 size-[150%] —— 百分比宽高分别按卡片的宽、高解析，
            卡片是 371×505 不是正方形，所以那其实是个**椭圆**，椭圆左切点落在卡内
            中间，看上去像一条竖线穿卡而过。设计稿实测是正圆：
            取弧上三点 (261,20) (364,140) (250,500) 解圆 ⇒ 圆心卡内 (106.8, 256.6)、R 282.4。
            圆心几乎贴在卡片左缘中线，所以只露出右上、右下两段弧，中间是空的 ——
            与实测（y 260/300/340 处无金色像素）吻合。
            用 aspect-square + 百分比宽度，既保证是圆，又能随卡片宽度缩放。
          */}
          <span
            aria-hidden
            className="absolute left-[-47.2%] top-[-5.1%] aspect-square w-[151.8%] rounded-full border border-[#c9a961]/45"
          />
          <img
            src={leaf}
            alt=""
            className="pointer-events-none absolute -right-2 -top-7.25 w-[46%] select-none"
            draggable={false}
          />

          <div className="relative flex h-full flex-col px-7 pt-12.5">
            <p className="text-2xs font-medium tracking-[0.42em] text-[#b08d4f]">INVITATION</p>
            <span className="mt-3.75 h-px w-7 bg-[#c9a961]/70" />

            <h2 className="mt-6.5 font-serif text-[38px] font-bold leading-tight text-ink">
              {D.title}
            </h2>
            <p className="mt-3 text-20 tracking-[0.28em] text-[#b08d4f]">— 诚邀您的莅临 —</p>

            <div className="mt-8.5 flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <CalendarDays className="size-5.5 shrink-0 text-ink" strokeWidth={1.7} />
                <span className="text-15 font-medium text-ink">
                  {D.date} {D.time}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5.5 shrink-0 text-ink" strokeWidth={1.7} />
                <div>
                  <p className="text-15 font-medium text-ink">{D.restaurant}</p>
                  <p className="mt-1.5 text-12 text-ink-2">{D.address}</p>
                </div>
              </div>
            </div>

            <p className="mt-11.5 text-14 leading-5.5 text-ok-fg">
              {D.line1}
              <br />
              {D.line2}
            </p>

            <div className="mt-auto pb-8">
              <span className="block h-px w-7 bg-[#c9a961]/70" />
              <p className="mt-2.75 text-[7.25px] leading-3.75 font-medium tracking-[0.26em] text-[#b08d4f]">
                TOGETHER
                <br />
                FOR A BRIGHTER TOMORROW
              </p>
            </div>
          </div>

          <img
            src={mascot}
            alt=""
            className="pointer-events-none absolute -bottom-14 -right-3.25 w-[67%] select-none"
            draggable={false}
          />
        </div>
      </section>

      {/* 样式选择。实测行高 68pt、列间距 10.3pt */}
      <div className="grid grid-cols-3 gap-2.5 px-page-wide pt-6">
        {INVITATION_STYLES.map(({ key, label }, i) => {
          const Icon = STYLE_ICON[i]
          const active = key === style
          return (
            <button
              key={key}
              onClick={() => setStyle(key)}
              aria-pressed={active}
              className={cn(
                'flex h-17 items-center justify-center gap-2 rounded-xl border bg-surface text-15 transition-colors',
                active
                  ? 'border-[1.5px] border-primary font-semibold text-primary-deep'
                  : 'border-line text-ink-1 active:bg-sunken',
              )}
            >
              <Icon className="size-4" strokeWidth={1.9} />
              {label}
            </button>
          )
        })}
      </div>

      {/* 渠道选择。行高同为 68pt，与样式行间距 10.3pt */}
      <div className="grid grid-cols-2 gap-2.5 px-page-wide pt-2.5">
        {INVITATION_CHANNELS.map(({ key, label }) => {
          const Icon = key === 'email' ? Mail : MessageSquare
          const active = key === channel
          return (
            <button
              key={key}
              onClick={() => setChannel(key)}
              aria-pressed={active}
              className={cn(
                'flex h-17 items-center justify-center gap-2 rounded-xl border bg-surface text-15 transition-colors',
                active
                  ? 'border-[1.5px] border-primary font-semibold text-primary-deep'
                  : 'border-line text-ink-1 active:bg-sunken',
              )}
            >
              <Icon className="size-4" strokeWidth={1.9} />
              {label}
            </button>
          )
        })}
      </div>
    </ScreenShell>
  )
}
