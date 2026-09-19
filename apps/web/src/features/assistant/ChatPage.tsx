import { History, SquarePen, TriangleAlert, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOpenhexChat, type ChatMessage } from '@openhex-ai/agent-sdk/react'
import assistantAvatar from '../../assets/avatar-assistant.png'
import { NavBar } from '../../app/NavBar'
import { ScreenShell } from '../../app/AppShell'
import { Chip } from '../../components/Button'
import { ChatInputBar } from '../../components/ChatInputBar'
import { cn } from '../../lib/cn'
import { INPUT_PLACEHOLDER, PROFILE_NAME, QUICK_ENTRIES } from '../../lib/mock'
import { ToolCallCard } from './ToolCallCard'
import { CardRenderer } from './cards/CardRenderer'
import { type Segment, cardsOf, forDisplay, parseCardBlocks, visibleText } from './cardBlocks'
import { useChatStore } from './chatStore'
import { Markdown } from './markdown'
import { OPENHEX_AGENT_ID, getOpenhexToken, isOpenhexConfigured } from './openhex'
import { MEMORY_BLOCK_RE, fetchMemory } from './memory'
import { listConversations, saveConversation, type ConversationSummary } from './history'

/**
 * UI-01 第 2 屏：对话页。
 *
 * 这一屏现在是 **OpenHex 的真实对话**，不再是前端脚本：消息、流式文本、
 * 工具调用、错误、对话 id 全部来自 `useOpenhexChat`。上一轮的 `mockFlow`
 * 状态机已经删掉 —— 推进对话是 Agent 的职责，前端再留一份就是两份真相。
 *
 * 三个数据来源的分工：
 *   - 文本气泡  ← hook 的 `message.text`（同一轮里逐字增长，所以在流式期间会不断重渲染）
 *   - 领域卡片  ← Agent 的工具调用，`ToolCallCard` 按 `input.kind` 映射（见该文件注释）
 *   - 快捷回复  ← 卡片自己的 `actions`，点击把 label 交给**同一个** `send`
 *
 * 结构事实：这一屏**没有底部 Tab 栏**，输入条直接贴底（`ScreenShell` 无 TabBar）。
 *
 * 气泡几何全部实测自 UI-01/02.png（同一张稿里用户气泡与助理气泡宽度都是 195.0pt，
 * 恰好是 390 的一半，说明是硬上限而非内容撑开）：
 *   气泡宽 195pt = 50%（**不是**按内容撑到底，改宽了整屏节奏就散了）
 *   头像 28pt、头像与气泡间距 14pt、页边距 21.6pt
 *     用户侧右缘 390 − 21.6 − 28 − 14 = 326.4，实测 326.3 ✓
 *     助理侧左缘 21.6 + 28 + 14 = 63.6，实测 63.8 ✓
 *   气泡高 130.3pt（5 行）→ 行高 21px + 上下 padding 12px
 *   两条消息之间 14pt（实测 254.5 − 240.5）
 * 助理头像是吉祥物头，视觉上比头像框大一圈，用负外边距放大而不撑开行宽。
 *
 * 卡片**不受 195pt 气泡上限约束**，也**不缩进到头像右侧**：那个上限是文字气泡的
 * 排版事实，卡片则要占满整条内容宽（346.8pt）。缩进到头像右缘只剩 304.8pt，
 * 餐厅卡会挤到换行。所以一条消息是「头像+气泡一行 → 卡片另起一块（整宽）」两层结构。
 */
export function ChatPage() {
  // 没配 Agent ID 时**不挂载对话组件**：hook 需要 agentId 才能建客户端，
  // 让它在缺配置的情况下先跑起来，只会把错误推迟到一个更难懂的地方。
  // 这里做组件级分支而不是在 hook 里判断 —— hook 不能条件调用。
  if (!isOpenhexConfigured) return <MissingConfig />
  return <ChatRoot />
}

/**
 * 对话页的「根」：管「现在看哪段对话」这一个状态，以及历史抽屉的开合。
 *
 * 切换 / 新建对话都靠**换 key 重挂** `ChatConversation` —— 这不是为了图省事，
 * 而是 SDK 的硬约束：`useOpenhexChat` 的 `conversationId` 只是初始值
 * （`initialConversationId ?? localStorage`），历史加载 effect 只在
 * `messages.length === 0` 时才填充。所以想在已挂载的实例上「切到另一段」是切不动的，
 * 必须卸载重挂，让 messages 从空数组重新长出来。
 */
function ChatRoot() {
  const [viewing, setViewing] = useState<string | undefined>(undefined)
  const [bootId, setBootId] = useState(0)
  const [ready, setReady] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // 进入即「自动恢复」：拉历史列表，若有则切到最近一段。
  // ready 前先渲染一个极简占位，避免「空白 → 恢复」闪一下。
  useEffect(() => {
    let cancelled = false
    listConversations()
      .then((list) => {
        if (cancelled) return
        if (list.length > 0) setViewing(list[0].id)
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <ScreenShell className="pb-2">
        <NavBar title="小燕知" />
        <div className="flex flex-1 items-center justify-center text-14 text-ink-3">加载中…</div>
      </ScreenShell>
    )
  }

  return (
    <>
      <ChatConversation
        key={viewing ?? `new-${bootId}`}
        conversationId={viewing}
        onNewConversation={() => {
          setViewing(undefined)
          setBootId((b) => b + 1)
        }}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={(id) => {
          setViewing(id)
          setHistoryOpen(false)
        }}
      />
    </>
  )
}

function ChatConversation({
  conversationId,
  onNewConversation,
  onOpenHistory,
}: {
  conversationId?: string
  onNewConversation: () => void
  onOpenHistory: () => void
}) {
  const { messages, error, isResponding, send, interrupt, retry, conversationId: liveId } = useOpenhexChat({
    agentId: OPENHEX_AGENT_ID,
    // getToken 每次请求前都会被调用，令牌快到期时它自己会去换新的
    getToken: getOpenhexToken,
    // 恢复到哪段由外层 ChatRoot 决定（我们的 DB 是权威来源），不再用 SDK 的
    // persist —— 两套「恢复到哪」并存会互相打架（persist 的 clear 会强制开新对话）。
    conversationId,
    senderName: PROFILE_NAME,
  })

  const consumePending = useChatStore((s) => s.consumePending)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 一轮收尾时把整段对话镜像写进自己的库（历史列表的数据源）。
  // 用 isResponding 的 true→false 跳变当触发点，而不是 SDK 的 onTurnComplete ——
  // 后者只在成功时触发，会漏掉「被打断 / 报错」的轮次里那条用户消息；
  // 跳变则覆盖成功 / 报错 / 打断三种收尾。liveId 未定时（还没发出第一条）不写。
  const prevResponding = useRef(isResponding)
  useEffect(() => {
    const settled = prevResponding.current && !isResponding
    prevResponding.current = isResponding
    if (settled && liveId && messages.length > 0) {
      void saveConversation(liveId, messages)
    }
  }, [isResponding, liveId, messages])

  // 包一层 send：新会话的**首条**消息前拼上画像。判据只用 `messages.length === 0` ——
  // 首条发出后 hook 会立刻把用户消息挂上列表，长度变成 1，后续不会再注入；
  // 点「新对话」clear 后长度归零，下一轮首条又会重新注入（正是想要的）。
  // 不需要 ref 去记「注没注过」：加了反而要在 clear 时去重置，徒增一处要对齐的状态。
  const sendWithMemory = useCallback(
    async (text: string) => {
      if (messages.length === 0) {
        const { injection } = await fetchMemory()
        await send(injection ? injection + text : text)
        return
      }
      await send(text)
    },
    [messages.length, send],
  )

  // 首页快捷入口带过来的话，进入即发出。
  //
  // 这里有两道**都必须有**的防线，少一道都会坏：
  //
  // 1. 读与清必须原子（走 store 的 consumePending）。不能在 effect 里读 `pending`
  //    再 setPending(null)：`pending` 是渲染闭包里的值，StrictMode 下 effect 跑两次，
  //    第二次拿到的还是旧值 —— 那就是真的向平台发两条消息。
  //
  // 2. 发送必须**挪出 effect 的同步执行体**（放进 setTimeout，并在 cleanup 里取消）。
  //    实测踩过：直接在 effect 里 `send(text)`，StrictMode 的「effect → cleanup →
  //    effect」会把第一次的 send 连人带 promise 一起丢掉 —— 请求确实发出去了
  //    （网络面板能看到），但它的失败结果写不回已被丢弃的状态，
  //    于是用户点「预定餐厅」进来只看到自己那句话，**既没有回复也没有报错**，
  //    就这么静默地卡住。挪到宏任务里执行，第一次的定时器已经被 cleanup 取消，
  //    真正发出去的只有第二次，而那一次落在稳定的实例上。
  useEffect(() => {
    const timer = setTimeout(() => {
      const text = consumePending()
      if (text) void sendWithMemory(text)
    }, 0)
    return () => clearTimeout(timer)
  }, [consumePending, sendWithMemory])

  // 流式期间文本是逐字长出来的，只盯着 messages.length 会停在原地不动，
  // 所以把最后一条的文本长度也算进依赖。
  const lastLength = messages.length ? messages[messages.length - 1].text.length : 0
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, lastLength])

  const onPrompt = useMemo(() => (text: string) => void sendWithMemory(text), [sendWithMemory])

  return (
    <ScreenShell
      footer={
        <ChatInputBar
          placeholder={INPUT_PLACEHOLDER}
          onSubmit={onPrompt}
          autoFocus
          // 一轮没结束时不让再发：平台的会话流按轮次推进，
          // 上一轮还没读完就发下一条，用户看到的是两轮回复交错在一起。
          busy={isResponding}
          onStop={interrupt}
        />
      }
      className="pb-2"
    >
      <NavBar
        title="小燕知"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenHistory}
              aria-label="历史对话"
              className="grid size-8.75 place-items-center rounded-full bg-surface shadow-card transition-colors active:bg-sunken"
            >
              <History className="size-4.5 text-ink" strokeWidth={1.9} />
            </button>
            {messages.length ? (
              <button
                onClick={onNewConversation}
                aria-label="新对话"
                className="grid size-8.75 place-items-center rounded-full bg-surface shadow-card transition-colors active:bg-sunken"
              >
                <SquarePen className="size-4.5 text-ink" strokeWidth={1.9} />
              </button>
            ) : null}
          </div>
        }
      />

      {error ? <ErrorBanner error={error} onRetry={retry} /> : null}

      {messages.length ? (
        <div className="flex flex-col gap-3.5 px-page pt-2">
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} onPrompt={onPrompt} />
          ))}
        </div>
      ) : (
        <EmptyState onPrompt={onPrompt} />
      )}

      <div ref={bottomRef} className="h-2" />
    </ScreenShell>
  )
}

function MessageRow({
  message,
  onPrompt,
}: {
  message: ChatMessage
  onPrompt: (text: string) => void
}) {
  const isUser = message.role === 'user'

  // Agent 的回复里可能夹着 ```lto-card 块（协议见仓库根目录 `卡片协议与提示词.md`）。
  // 用户消息不解析 —— 那是给 Agent 的约定，用户偶尔粘一段带围栏的文本不该被吞掉。
  //
  // 不用 useMemo：这里就几行字符串扫描，而下面有个 role === 'system' 的提前 return，
  // 引进 hook 只会换来一条 rules-of-hooks 的麻烦。
  const segments: Segment[] = isUser
    ? // 首条消息前面拼过画像（见 sendWithMemory），渲染时剥掉 —— 那是给 Agent 看的，
      // 不该出现在用户自己的气泡里。
      [{ type: 'text', text: message.text.replace(MEMORY_BLOCK_RE, '') }]
    : parseCardBlocks(message.text)
  // 未闭合的块在流式期间要藏（否则 JSON 原文逐字蹦给用户看），结束后要露（模型漏写围栏时别丢内容）
  const shown = isUser ? segments : forDisplay(segments, message.pending === true || message.streaming === true)
  const text = visibleText(shown)
  const cards = cardsOf(shown)
  const hasText = text.length > 0

  // 系统消息（平台事件，不是对话内容）走中缝小字，不套气泡：
  // 给它一个用户/助理头像会让用户以为「有人在说话」。
  if (message.role === 'system') {
    return (
      <p className="px-6 text-center text-2xs text-ink-3">{message.text}</p>
    )
  }

  // 「正在回复」只在**真的还在等**的时候显示。两个反例都实测踩过：
  //   - SDK 失败时会 patch 成 `{ pending: false, error: true }`，只看 `!hasText`
  //     的话出错后那三个点会一直转 —— 一边报错一边转圈，用户不知道等还是重试。
  //   - **只有卡片、没有正文**的一轮（Agent 这轮只调了工具）同样 `!hasText`，
  //     但它已经答完了。按 `!hasText` 判断的话，一个永远转下去的三个点会挂在
  //     每一张卡片上方 —— 而这只读 `!hasText` 的写法恰恰是最容易顺手写出来的那种。
  const waiting = !isUser && !hasText && (message.pending === true || message.streaming === true)
  const hasCards = cards.length > 0 || Boolean(message.toolCalls?.length)

  // 没有正文、也不在等（出错的空回复，或纯卡片消息）→ 连头像那一行都不画，
  // 只留卡片。工具调用是这一轮的真实产出，不能跟着一起藏掉。
  const showBubbleRow = hasText || waiting
  if (!showBubbleRow && !hasCards) return null

  return (
    <div className="flex flex-col gap-2.5">
      {showBubbleRow ? (
        <div className={cn('flex items-start gap-3.5', isUser && 'flex-row-reverse')}>
          {isUser ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#ecf1eb]">
              <UserRound className="size-4 text-ink-2" strokeWidth={1.9} />
            </span>
          ) : (
            <img
              src={assistantAvatar}
              alt=""
              className="-mx-1 -my-1 size-9 shrink-0 object-contain"
              draggable={false}
            />
          )}

          {/* 上限**只给用户气泡**，助手气泡不设。
              195pt 是在 UI-01/02.png 的**短气泡**上量出来的（两侧都是 195.0pt），
              它没有说过「长回复也该是 195」。真 Agent 的回复动辄两百多字，
              套上这个上限就是一屏高的窄柱（上面还接着整宽的卡片），
              看起来像样式坏了而不是排版意图 —— 那是把一次测量用在了它没覆盖的条件下。
              宽度必须取 token、**不能写 max-w-[50%]**：这里是 flex 项，
              百分比会相对内容列的宽度解析成 149pt，设计稿的一行就被挤成两行。

              助手侧去掉上限**不会**把短回复也撑宽：气泡是 flex 项且 flex-grow:0，
              宽度取 min(max-content, 可用宽度)，所以「几点？」这类短句自己还是窄的，
              只有内容真的超长时才长到 304.8pt（头像右缘 → 页边距）。
              与整宽卡片（346.8pt）还差 42pt；若设计侧仍觉得不齐，
              下一步是把长回复的气泡整个去掉（纯文本块占满 346.8），气泡只留给短句。 */}
          {hasText ? (
            <div
              className={cn(
                // **没有 whitespace-pre-line**：换行现在由 Markdown 渲染成 <br/>，
                // 两者同时开着的话，段落间的空行会被算两遍（一次 pre-line、一次块间距），
                // 气泡里就多出一段没有来由的空白。
                'rounded-2xl px-3.5 py-3 text-14 break-words',
                isUser
                  ? 'max-w-(--lto-bubble-max) self-end bg-[#e6f2e6] text-ink-1'
                  : 'max-w-none bg-surface text-ink-1 shadow-card',
              )}
            >
              <Markdown text={text} />
            </div>
          ) : waiting ? (
            // 本轮已发出、但第一个字还没到的空档。**不能渲染空气泡**：
            // 一个没有内容的白色圆角块看起来像渲染坏了，也不占位、消息会跳。
            <ThinkingBubble />
          ) : null}
        </div>
      ) : null}

      {/*
        卡片**不缩进到头像右侧**，而是自己占满整条内容宽（346.8pt = 390 − 21.6×2）。
        头像只占消息的第一行，卡片在它下方 —— 强行让卡片对齐头像右缘只剩 304.8pt，
        餐厅卡在这种宽度下标签会被迫换行、「人均」还会竖排断成两行
        （照片是按 372pt 宽的找餐厅页标定的 146pt 固定宽，挤不动）。
        min-w-0 不能省：flex 子项默认 min-width:auto，长文本会把整行顶出视口。
      */}
      {hasCards ? (
        <div className="flex min-w-0 flex-col gap-2.5">
          {/* 文本里解析出来的卡片排在工具卡前面：它是这一轮的**结论**，工具卡是过程。
              键用「消息 id + 序号」而不是卡片自己的 id —— 模型给的 id 是业务键，
              同一轮里重复（比如两张同类卡）会撞键，渲染时就串了。 */}
          {cards.map((card, i) => (
            <CardRenderer key={`${message.id}-card-${i}`} card={card} onPrompt={onPrompt} />
          ))}
          {message.toolCalls?.map((toolCall, i) => {
            // 工具调用没有稳定的业务 id（同一轮里同名工具可能被调多次），
            // 所以用「消息 id + 序号」当键 —— 顺序由 hook 保证是追加的。
            const fallbackId = `${message.id}-tool-${i}`
            return (
              <ToolCallCard
                key={toolCall.id ?? fallbackId}
                toolCall={toolCall}
                fallbackId={fallbackId}
                onPrompt={onPrompt}
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/**
 * 等待回复占位：三个点错峰跳动，示意「在生成」而不是「卡住了」。
 *
 * 高度刻意取 45px（= 一行正文 21px 行高 + 上下 padding 12px），与单行文字气泡等高。
 * 不是为了好看，而是因为助理头像那张图是个「头 + 气泡尖角」的合成图：
 * 尖角落在图像方框的右下角，只有气泡高度和位置对得上时它才贴着气泡。
 * 高度随便定的话，那个尖角会孤零零地悬在头像和气泡之间（实测见过这个效果）。
 */
function ThinkingBubble() {
  return (
    <div
      className="flex h-11.25 items-center gap-1 self-start rounded-2xl bg-surface px-3.5 shadow-card"
      aria-label="正在回复"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-ink-3"
          style={{ animationDelay: `${i * 140}ms`, animationDuration: '1s' }}
        />
      ))}
    </div>
  )
}

/**
 * 空态。**不给一段假的示例对话** —— 那会让界面显示一段平台并不知情的「历史」，
 * 用户接着问「那家餐厅」时 Agent 一脸茫然。宁可空着，把能做的事摆出来。
 */
function EmptyState({ onPrompt }: { onPrompt: (text: string) => void }) {
  return (
    <div className="flex flex-col items-start gap-3 px-page pt-6">
      <p className="text-14 text-ink-2">有什么可以帮你？也可以先从这些开始：</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_ENTRIES.map((entry) => (
          <Chip key={entry.key} onClick={() => onPrompt(entry.prompt)}>
            {entry.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

/**
 * 出错了要给出路，不能只留一个静默的空屏。`retry` 重发最后一条用户消息，
 * 所以这里说明「上一次没发出去」，避免用户以为 Agent 没理他。
 */
function ErrorBanner({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="mx-page mt-2 flex items-start gap-2.5 rounded-card bg-danger-bg px-3.5 py-3">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger-fg" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="text-13 break-words text-danger-fg">{error.message}</p>
        <button
          onClick={onRetry}
          className="mt-1.5 text-13 font-medium text-danger-fg underline underline-offset-2"
        >
          重试
        </button>
      </div>
    </div>
  )
}

/**
 * 历史对话抽屉：底部滑出的列表，数据来自自己的库（OpenHex 平台的镜像）。
 *
 * 每条只显示标题 / 时间 / 条数；点某条让外层 `onSelect(id)` 切过去 ——
 * 正文的完整还原（含领域卡片）由重挂后的对话组件从 OpenHex 拉，这里不重复存渲染。
 */
function HistoryDrawer({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const [items, setItems] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    listConversations()
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="关闭历史" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[80vh] w-full max-w-(--lto-app-max) flex-col rounded-t-card bg-bg pb-safe shadow-raised">
        <div className="flex items-center justify-between px-page py-3.5">
          <h2 className="text-17 font-semibold text-ink">历史对话</h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="grid size-8.75 place-items-center rounded-full bg-surface shadow-card active:bg-sunken"
          >
            <X className="size-4.5 text-ink" strokeWidth={1.9} />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-page pb-6">
          {loading ? (
            <p className="py-8 text-center text-13 text-ink-3">加载中…</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-13 text-ink-3">还没有历史对话</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => onSelect(c.id)}
                    className="w-full rounded-card bg-surface px-3.5 py-3 text-left shadow-card active:bg-sunken"
                  >
                    <p className="truncate text-15 font-medium text-ink-1">{c.title || '（无标题）'}</p>
                    <p className="mt-1 text-12 text-ink-3">
                      {relativeTime(c.updated_at)} · {c.message_count} 条消息
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/** 纪元毫秒 → 列表用的相对时间。越近越具体，够老就落回日期，避免「12345 分钟前」这种读不懂的。 */
function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 2 * day) return '昨天'
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  return new Date(ms).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

/**
 * 缺配置时的说明页。把「要配哪个变量、它是干什么的」直接写在屏幕上 ——
 * 这类问题一定会发生，而且发生时通常是在别人的机器上，
 * 只留一行 console 报错等于让它再发生一次。
 */
function MissingConfig() {
  return (
    <ScreenShell className="pb-2">
      <NavBar title="小燕知" />
      <div className="flex flex-col gap-3 px-page pt-4 text-14 text-ink-2">
        <p className="font-medium text-ink-1">还没有配置 OpenHex Agent</p>
        <p>
          在 <code className="rounded bg-sunken px-1.5 py-0.5 text-13">apps/web/.env</code> 里填上
          Agent ID（见 <code className="rounded bg-sunken px-1.5 py-0.5 text-13">.env.example</code>
          ），重启开发服务器：
        </p>
        <pre className="overflow-x-auto rounded-card bg-sunken px-3.5 py-3 font-mono text-2xs text-ink-1">
          VITE_OPENHEX_AGENT_ID=&lt;Agent 的 UUID&gt;
        </pre>
        <p className="text-13 text-ink-3">
          Agent ID 不是密钥，可以放在前端。真正的密钥（<code>sk_…</code>）只留在
          <code className="mx-1 rounded bg-sunken px-1.5 py-0.5 text-13">apps/api</code>
          里，由它签发会话令牌。
        </p>
      </div>
    </ScreenShell>
  )
}
