import { CalendarDays, Coins, DoorOpen, MapPin, Share2, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PlanSummaryCard } from '@lto/cards'
import { PrimaryButton } from '../../../components/Button'
import { Row } from './Row'

/**
 * 用餐计划卡 —— **流程的终态卡**，一张卡同时是「计划」和「邀请函」。
 *
 * 三件事是刻意的，改之前先读：
 *
 * ① **不套 `CardShell`**，自己搭外壳。理由不是嫌它不好用，是 `cn` 只是朴素 join
 *    （`lib/cn.ts`，没有 tailwind-merge），所以**不能靠传 className 覆盖它的 `p-3.5`** ——
 *    同权重的两个 padding 谁生效取决于 Tailwind 生成顺序，不可预测。
 *    而这张卡需要报头**通栏出血到卡片边缘**（色带顶到圆角），内边距必须由我自己排。
 *    这里复用的是 token 本身（`rounded-card` / `bg-surface` / `shadow-card`），
 *    也就是真正的单一来源；复制的是三个类和它们排出来的节奏，不是一份会漂的魔法数。
 *
 * ② **分享按钮硬编码，不走 `card.actions`**。分享是**终态动作**：它不回给模型、
 *    不产生下一轮对话，所以它不是 `CardAction`（那三种 kind 的语义都是「把 label 发回 Agent」
 *    或路由跳转）。同款先例：`InvitationCardView` 的渠道按钮、`ProgressCardView` 干脆不接 `onPrompt`。
 *    组件因此**不收 `onPrompt`** —— 收了就等于给这张卡留了一个「还能继续聊」的假接口。
 *
 * ③ **没有 `channels`**。渠道选择是「发送」的实现细节；这里只有一个动作：
 *    优先调起系统分享面板（`navigator.share`），否则降级为复制文本 ——
 *    降级不只看「有没有 share」，还要看「share 是不是真的能用」，见 `onShare`。
 *
 * 分享内容里**不带 URL**：任务还没落库、也没有 `/tasks/:id` 这样的深链路由
 * （技术方案里「任务可深链分享」是后端落地后的能力）。现在硬塞一个链接会指向 404，
 * 比不分享链接更糟。等深链有了，这里补 `url` 字段即可。
 */
export function PlanSummaryCardView({ card }: { card: PlanSummaryCard }) {
  const { plan } = card
  const [state, setState] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)

  // 组件卸载时清掉「已复制」的回退定时器，否则它会在卸载后 setState
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const title = plan.title || card.title || '用餐计划'

  /**
   * 分享文本。逐行拼而不是写一整块字面量：`room` 是可选的，
   * 拼字符串能在缺包间时**整段消失**，而带占位符的模板会留下一行空的或「undefined」。
   */
  function shareText(): string {
    const lines = [
      title,
      `${plan.date} ${plan.time}`.trim(),
      `${plan.restaurant} · ${plan.address}`,
      [plan.room, `${plan.people} 人`, `人均 ¥${plan.perCapita}`, `合计 ¥${plan.total.toLocaleString('zh-CN')}`]
        .filter(Boolean)
        .join(' · '),
    ]
    return lines.filter(Boolean).join('\n')
  }

  /** 落地反馈：文案翻一下再翻回来，无 toast 组件，不为此引库 */
  function flash(next: typeof state) {
    setState(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 2000)
  }

  /**
   * 桌面降级：复制。
   *
   * ⚠️ `navigator.clipboard` 和 `navigator.share` 一样是**安全上下文专属**的
   * （HTTPS 或 localhost），明文 HTTP 访问服务器 IP 时整个 `navigator.clipboard` 是
   * `undefined`。
   *
   * 所以这里**必须先判存在再调**，不能写 `navigator.clipboard?.writeText(text)`：
   * 可选链在 clipboard 为 undefined 时求值成 `undefined`，`await undefined` 是**成功**的
   * —— 于是「什么都没复制」被当成复制成功，按钮显示「已复制」。这比没反应更糟：
   * 用户以为内容在剪贴板里了，粘贴出来是空的。实测踩到过。
   */
  async function copy(text: string) {
    if (typeof navigator.clipboard?.writeText !== 'function') {
      // HTTP 下的常态。不是我们的 bug，浏览器就是这么规定的 —— 如实告诉用户
      // 「自己长按选吧」，这是这个环境下唯一真能用的路径。
      flash('failed')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      flash('copied')
    } catch {
      // 有 clipboard 但仍可能拒绝（没有用户激活、文档失焦、权限被拒）
      flash('failed')
    }
  }

  async function onShare() {
    const text = shareText()

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text })
        // 面板走完 = 确实分享出去了。没有这句的话成功路径**一点反馈都没有**，
        // 用户从系统面板回到页面，看到的还是那颗原样的按钮，不知道成没成。
        flash('shared')
      } catch (err) {
        // AbortError 是用户自己点了取消 —— 正常操作，静默，不要弹错误骂用户。
        if ((err as DOMException | undefined)?.name === 'AbortError') return
        // 其余（最常见的 NotAllowedError：桌面浏览器有 share 但被策略/非用户激活挡掉）
        // 说明这台环境**打不开面板**，那就走本来该走的降级，而不是静默吞掉。
        //
        // 实测记一笔：无头 Chrome 里 `navigator.share()` 返回的 promise **永不 settle**，
        // 既不 resolve 也不 reject（连未被用户激活都不 reject），所以那种环境下面板、
        // 复制、提示会一样都没有。这里拦不住它（没有可 hook 的时机），
        // 真机上系统面板正常弹出，属可接受的残余风险，记录在此以免被当成已覆盖。
        await copy(text)
      }
      return
    }

    await copy(text)
  }

  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-card">
      {/* 报头色带：通栏到卡片圆角，靠外层 overflow-hidden 裁 */}
      <div className="bg-primary-tint px-3.5 py-3">
        <p className="text-2xs font-medium text-primary-deep">用餐计划</p>
        <h3 className="mt-0.5 text-18 font-semibold break-words text-ink">{title}</h3>
      </div>

      <div className="px-3.5 py-3">
        <dl className="flex flex-col gap-2">
          <Row icon={<CalendarDays className="size-3.5 text-primary" strokeWidth={1.9} />}>
            <span className="text-ink-1">{plan.date}</span>
            <span className="text-ink-3"> · {plan.time}</span>
          </Row>
          <Row icon={<Users className="size-3.5 text-primary" strokeWidth={1.9} />}>
            <span className="text-ink-1">{plan.people} 人</span>
          </Row>
          <Row icon={<MapPin className="size-3.5 text-primary" strokeWidth={1.9} />}>
            <span className="text-ink-1">{plan.restaurant}</span>
            <span className="text-ink-3"> · {plan.address}</span>
          </Row>
          {/* 包间**不确定就不显示**：模型没给时整行不出现，
              而不是渲染成「包间 待定」—— 那会被读成「已经安排好了」 */}
          {plan.room ? (
            <Row icon={<DoorOpen className="size-3.5 text-primary" strokeWidth={1.9} />}>
              <span className="text-ink-1">{plan.room}</span>
            </Row>
          ) : null}
          <Row icon={<Coins className="size-3.5 text-primary" strokeWidth={1.9} />}>
            <span className="text-ink-1">人均 ¥{plan.perCapita}</span>
          </Row>
        </dl>

        <div className="mt-3 flex items-baseline justify-between rounded-xl bg-primary-tint px-3.5 py-2.5">
          <span className="text-13 text-ink-2">合计</span>
          <span className="text-17 font-bold text-primary">
            ¥{plan.total.toLocaleString('zh-CN')}
          </span>
        </div>

        {/* aria-label 保持恒定：按钮文案会在几种反馈之间来回翻，
            但它始终是同一个动作。端到端脚本也靠它稳定定位。 */}
        <PrimaryButton className="mt-3" onClick={onShare} aria-label="分享用餐计划">
          <span className="inline-flex items-center justify-center gap-1.5">
            <Share2 className="size-4.5" strokeWidth={2} />
            {state === 'shared'
              ? '已分享'
              : state === 'copied'
                ? '已复制'
                : state === 'failed'
                  ? '复制失败，请长按选中'
                  : '分享用餐计划'}
          </span>
        </PrimaryButton>
      </div>
    </div>
  )
}
