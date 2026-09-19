import { Send, Square } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { cn } from '../lib/cn'

/**
 * 底部输入条。UI-01 首页/对话页实测：
 * 整宽、高 58pt、全圆角胶囊、白底；发送按钮是直径 45pt 的品牌绿实心圆，
 * 内含白色纸飞机。
 *
 * 发送按钮**始终是实心品牌绿**：设计稿里输入框为空（只显示 placeholder）时
 * 按钮就是实心绿，不存在「无输入则变淡」的态。空输入时点击不提交即可，
 * 用降透明度表达禁用会与设计稿不符。
 *
 * `busy` 是接入 OpenHex 后加的：Agent 一轮回复可能要十几秒，这期间按钮变成
 * 「停止」——它是同一颗绿圆按钮换了个图标，所以设计稿的视觉事实没有被破坏。
 * 停止走 `interrupt`，是**服务端**打断，不只是本地不看流（见 SDK 的 Chat 文档）。
 */
export function ChatInputBar({
  placeholder,
  onSubmit,
  autoFocus,
  busy = false,
  onStop,
  className,
}: {
  placeholder: string
  onSubmit: (text: string) => void
  autoFocus?: boolean
  /** 一轮回复进行中：禁止再发，按钮切换成停止 */
  busy?: boolean
  /** 停止当前这一轮（服务端打断） */
  onStop?: () => void
  className?: string
}) {
  const [text, setText] = useState('')
  const stoppable = busy && Boolean(onStop)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // 上一轮没结束时不再发下一条：平台的会话流按轮次推进，
    // 上一轮还在流，新消息会让两轮回复在界面上交错。
    if (busy) return
    const value = text.trim()
    if (!value) return
    onSubmit(value)
    setText('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex h-[var(--lto-inputbar-h)] items-center rounded-pill bg-surface pl-5',
        'pr-[var(--lto-send-inset)]',
        'shadow-[0_2px_14px_rgba(23,53,42,0.07)]',
        className,
      )}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        enterKeyHint="send"
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-15 text-ink-1 outline-none placeholder:text-ink-3"
      />
      <button
        // busy 时不能是 submit：按回车会触发表单提交，那正是我们要挡掉的动作
        type={stoppable ? 'button' : 'submit'}
        onClick={stoppable ? onStop : undefined}
        aria-label={stoppable ? '停止生成' : '发送'}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-primary transition-colors active:bg-primary-press"
      >
        {stoppable ? (
          <Square className="size-3.5 text-on-primary" strokeWidth={2} fill="currentColor" />
        ) : (
          <Send
            className="size-5 -translate-y-px text-on-primary"
            strokeWidth={2}
            fill="currentColor"
          />
        )}
      </button>
    </form>
  )
}
