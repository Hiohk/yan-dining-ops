import { Bell, ConciergeBell, Handshake, LayoutGrid, Users, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import mascot from '../../assets/mascot-home.png'
import { AppShell } from '../../app/AppShell'
import { ChatInputBar } from '../../components/ChatInputBar'
import { IconCircle } from '../../components/IconCircle'
import { HOME_GREETING, INPUT_PLACEHOLDER, QUICK_ENTRIES, type QuickEntryKey } from '../../lib/mock'
import { useChatStore } from './chatStore'

/**
 * UI-01 第 1 屏：AI 助理首页。
 *
 * 结构是「英雄式」而非消息列表：标题 → 问候气泡 → 吉祥物 → 2×2 快捷入口 → 输入条。
 * 首页的输入条是入口，真正的对话在 /chat（UI-01 第 2 屏）—— 那一屏没有底部 Tab。
 */

const ENTRY_ICON: Record<QuickEntryKey, LucideIcon> = {
  restaurant: ConciergeBell,
  // Handshake 而不是餐具类图标：这一格要说的是「商务」，餐具和隔壁的
  // 预定餐厅（ConciergeBell）、团队餐（Users）在语义上会糊成一片。
  banquet: Handshake,
  team: Users,
  other: LayoutGrid,
}

export function HomePage() {
  const navigate = useNavigate()
  const setPending = useChatStore((s) => s.setPending)

  function goChat(text: string) {
    setPending(text)
    navigate('/chat')
  }

  return (
    <AppShell withInputBar>
      <header className="flex items-center gap-2 px-page pt-3">
        <h1 className="text-24 font-bold tracking-tight text-ink">小燕知</h1>
        {/* 副标题实测墨宽 135pt；text-13 只有 122（窄 10.7%），text-14 才对上 */}
        <p className="mt-1 text-14 text-ink-2">你的企业餐饮 AI 助手</p>
        <button
          aria-label="通知"
          className="ml-auto grid size-9 place-items-center rounded-full transition-colors active:bg-sunken"
        >
          <Bell className="size-5.5 text-ink" strokeWidth={1.8} />
        </button>
      </header>

      {/* 问候气泡 + 吉祥物：UI-01 首页的英雄区 */}
      <section className="flex flex-col items-center px-page pt-5">
        {/*
          问候气泡实测（UI-01/01.png）：x 85.6..305.0（宽 219.4、**水平居中**）、
          y 111.1..216.1（高 105）；无头像，四行硬换行，左对齐，文字左缘 110。
          行距 21.6、内边距约 9（4 × 21.6 + 18 = 104.4 ≈ 105）、左内边距 23.4。
          宽度走 token 而不是百分比 —— 百分比在这里同样会随容器内边距漂移。
        */}
        <div className="relative w-(--lto-greeting-w)">
          <div className="rounded-2xl bg-surface px-6 py-2.25 shadow-card">
            <p className="whitespace-pre-line text-15 leading-5.4 text-ink-1">{HOME_GREETING}</p>
          </div>
          {/* 气泡小尾巴：指向下方的吉祥物 */}
          <span
            aria-hidden
            className="absolute -bottom-1.5 left-[36%] size-3 rotate-45 rounded-[3px] bg-surface"
          />
        </div>

        {/*
          吉祥物图四周有 14px 设计稿留白（占框宽 5%），所以：
          w-[76%] 让**内容**宽度落在实测的 249.8pt；
          -mt-1.5 抵消顶部那 6.6pt 留白，使「气泡底 → 吉祥物顶」的间隔回到实测的 0.9pt。
        */}
        <img
          src={mascot}
          alt="小燕知"
          className="pointer-events-none -mt-1.5 w-[76%] max-w-75 select-none"
          draggable={false}
        />
      </section>

      {/* 2×2 快捷入口。间距/高度/图标直径均见 tokens.css 的实测注释 */}
      <section className="grid grid-cols-2 gap-x-(--lto-tile-gap-x) gap-y-(--lto-tile-gap-y) px-page pt-3">
        {QUICK_ENTRIES.map(({ key, label, prompt }) => (
          <button
            key={key}
            onClick={() => goChat(prompt)}
            className="flex h-(--lto-tile-h) items-center gap-3.75 rounded-card bg-surface pl-3.75 pr-3 shadow-card transition-transform active:scale-[0.985]"
          >
            <IconCircle icon={ENTRY_ICON[key]} size={40} />
            <span className="text-14 font-semibold text-ink">{label}</span>
          </button>
        ))}
      </section>

      {/* 输入条浮在 Tab 栏之上 */}
      <div
        className="fixed inset-x-0 z-20 mx-auto w-full max-w-(--lto-app-max) px-page"
        style={{ bottom: 'calc(var(--lto-tabbar-h) + var(--lto-safe-bottom) + var(--lto-inputbar-gap))' }}
      >
        <ChatInputBar placeholder={INPUT_PLACEHOLDER} onSubmit={goChat} />
      </div>
    </AppShell>
  )
}
