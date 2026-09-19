/**
 * 卡片块解析 —— 把 Agent 回复里的 ```lto-card 代码块切成「文本段 / 卡片段」。
 *
 * 背景：平台**没有**自定义卡片原语（`raw` 里只可能是收款 / 信息收集 / 连接器配置），
 * 结构化数据进前端唯一的通道是工具调用。所以我们和 Agent 约定：要出卡片时，
 * 在回复里插一个 `lto-card` 围栏块，由这里解析出来交给 `CardRenderer`。
 * 协议与提示词见仓库根目录 `卡片协议与提示词.md`。
 *
 * 这个模块有两条不可动摇的纪律，都是为了「宁可难看，不可丢内容」：
 *
 *   ① **流式安全**：`useOpenhexChat` 是逐字流式的，收到一半时会出现**未闭合**的块。
 *      若直接渲染，用户会先看到一大段 JSON 原文逐字蹦出来，闭合瞬间才「啪」地变成卡片。
 *      所以未闭合的部分单独标成 `raw` 段，由调用方按「是否还在流」决定藏不藏 ——
 *      这个判断需要 hook 的流式状态，只有组件层知道，所以策略留在那边。
 *
 *   ② **解析失败不吞内容**：JSON 畸形、缺字段、根本不像卡片 —— 一律退回文本段。
 *      模型输出是不可信内容，一个坏的 JSON 不该让整条回复凭空消失。
 */

import type { AnyCard } from '@lto/cards'

export type Segment =
  | { type: 'text'; text: string }
  | { type: 'card'; card: AnyCard }
  /** 未闭合的块（流式中间态，或模型漏写结束围栏）。调用方决定原样显示还是藏起来。 */
  | { type: 'raw'; text: string }

/** 开围栏：```lto-card（反引号数量按 CommonMark 允许 3 个以上） */
const OPEN = /^[ \t]*(`{3,})[ \t]*lto-card[ \t]*$/

function closingFence(backticks: number): RegExp {
  // 反引号不能少于开围栏 —— 否则块内容里出现 ``` 就会提前截断。
  //
  // 结尾**故意不锚定行尾**，而是把同一行剩下的内容捕获出来当正文。
  // 实测踩过：真 Agent 写出过
  //     ```两件事补一句：
  // 这个形状（结束围栏后没换行）。若要求围栏独占一行，整块就被判成「未闭合」，
  // 于是卡片退化成一大段 JSON 原文糊在屏幕上 —— 严格反而坏了事。
  // 宽松的代价是「块内某行以 ``` 开头」会提前收尾，而严格 JSON 里不会有这种行。
  return new RegExp(`^[ \\t]*\`{${backticks},}(.*)$`)
}

/**
 * 末尾逗号是模型最常犯的 JSON 错误（写惯了 JS 对象字面量）。
 * 只修这一种：修多了会把合法内容改坏，而修不动的那些还有「退回文本」兜着。
 */
function parseLoose(body: string): unknown {
  const trimmed = body.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    try {
      return JSON.parse(trimmed.replace(/,(\s*[}\]])/g, '$1'))
    } catch {
      return null
    }
  }
}

/**
 * 一个块要能当卡片用，至少得有协议基座字段。
 * 只校验到这一步 —— kind 认不认识是 `CardRenderer` 的事（它有降级渲染），
 * 这里拦的是「这压根不是卡片」（比如模型在块里写了一段说明文字）。
 */
function toCard(value: unknown): AnyCard | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const card = value as Record<string, unknown>
  if (typeof card.v !== 'number') return null
  if (typeof card.id !== 'string' || !card.id) return null
  if (typeof card.kind !== 'string' || !card.kind) return null
  return card as unknown as AnyCard
}

export function parseCardBlocks(raw: string): Segment[] {
  // 先归一化换行：Windows 风格的 \r 会让 `[ \t]*$` 匹配不上，围栏就永远闭合不了
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const segments: Segment[] = []
  let buffer: string[] = []

  const flushText = (): void => {
    if (!buffer.length) return
    const text = buffer.join('\n')
    buffer = []
    if (text.trim()) segments.push({ type: 'text', text })
  }

  let i = 0
  while (i < lines.length) {
    const open = OPEN.exec(lines[i])
    if (!open) {
      buffer.push(lines[i])
      i += 1
      continue
    }

    const close = closingFence(open[1].length)
    let j = i + 1
    let tail = ''
    while (j < lines.length) {
      const closed = close.exec(lines[j])
      if (closed) {
        // 结束围栏同一行后面可能还有正文（见 closingFence 的注释），那是正文，不能丢
        tail = closed[1]
        break
      }
      j += 1
    }

    if (j >= lines.length) {
      // 没有结束围栏。两种可能分不开：还在流式（马上就来），或者模型漏写了。
      // 分辨不了就都按 raw 交给调用方 —— 它知道现在是不是还在流。
      flushText()
      segments.push({ type: 'raw', text: lines.slice(i).join('\n') })
      return segments
    }

    const card = toCard(parseLoose(lines.slice(i + 1, j).join('\n')))
    if (card) {
      flushText()
      segments.push({ type: 'card', card })
      // 推在 flushText 之后：这样它排在这张卡**后面**，与屏幕上的顺序一致
      if (tail.trim()) buffer.push(tail)
    } else {
      // 不是卡片（或 JSON 坏了）：原样留在文本里，让用户至少看得见内容
      buffer.push(...lines.slice(i, j + 1))
    }
    i = j + 1
  }

  flushText()
  return segments
}

/**
 * 按「是否还在流式」决定未闭合块的去留 —— 这是 `raw` 段的唯一处置点。
 *
 *   流式中 → 藏起来，否则 JSON 原文会逐字蹦到用户脸上；
 *   已结束 → 原样显示，因为这时它只可能是模型漏写了结束围栏，丢掉就等于吞内容。
 */
export function forDisplay(segments: Segment[], streaming: boolean): Segment[] {
  return streaming ? segments.filter((s) => s.type !== 'raw') : segments
}

/** 卡片段之外的可见文本，按段落拼回一整块 —— 气泡仍然只画一个。 */
export function visibleText(segments: Segment[]): string {
  return segments
    .filter((s): s is { type: 'text' | 'raw'; text: string } => s.type !== 'card')
    .map((s) => s.text)
    .join('\n\n')
    .trim()
}

export function cardsOf(segments: Segment[]): AnyCard[] {
  return segments.filter((s): s is { type: 'card'; card: AnyCard } => s.type === 'card').map((s) => s.card)
}
