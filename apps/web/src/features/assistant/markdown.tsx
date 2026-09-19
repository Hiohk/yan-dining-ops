import { type ReactNode } from 'react'

/**
 * 极简 Markdown 渲染（**无第三方依赖**）。
 *
 * 为什么不装 marked / react-markdown：
 *   ① 那类库的产物是 HTML **字符串**，要显示就得 `dangerouslySetInnerHTML`。
 *      而这段文字来自模型 —— 等于把模型的输出当 HTML 执行。这里全程产出 React 元素，
 *      没有 innerHTML，注入面为零。这一条本身就够定案了。
 *   ② 模型实际只用到很小一个子集（段落、**粗体**、`代码`、列表、标题、分隔线）。
 *
 * 两个**刻意**的取舍，都是为了不「比不做更糟」：
 *
 *   · **不解析 `_斜体_`**。下划线在正文里到处都是（`sp_user_ref`、`OPENHEX_API_KEY`、
 *     `is_public`），按标准 Markdown 规则 `_user_` 会被吞成斜体 —— 正文从此开始出错，
 *     而且错得很隐蔽。宁可少一种格式，也不能改坏正文。
 *
 *   · **单个换行保留成 `<br/>`**，与原来 `whitespace-pre-line` 的排版逐字一致。
 *     也就是说这次改动是「在原有换行之上多认几种标记」，不是重新排版 ——
 *     已按设计稿标定过的气泡几何不会因此漂移。
 *
 * 支持的块：段落、无序列表（`-` `*` `·` `•`）、有序列表（`1.` `1、`）、
 *   标题（`#`~`####`，统一渲染成加粗行）、分隔线。
 * 不支持：表格、引用块、嵌套列表、块内嵌套行内标记（`**a `b`**` 里的 `b` 不解析）。
 *   真需要时再加 —— 现在加等于替模型猜它要写什么。
 */

type Token =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'em'; text: string }
  | { type: 'del'; text: string }
  | { type: 'link'; text: string; href: string }

/**
 * 行内标记。一个正则一次扫完，**顺序即优先级**：
 * `**` 必须排在 `*` 前面，否则 `**粗**` 会被当成两个单星号。
 * 代码段排最前 —— 反引号里的内容不该再被当成标记（`**` 在代码里是字面量）。
 */
const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g

function inlineTokens(line: string): Token[] {
  const out: Token[] = []
  let last = 0
  for (const m of line.matchAll(INLINE)) {
    const at = m.index ?? 0
    if (at > last) out.push({ type: 'text', text: line.slice(last, at) })
    const s = m[0]
    if (s.startsWith('`')) out.push({ type: 'code', text: s.slice(1, -1) })
    else if (s.startsWith('**')) out.push({ type: 'strong', text: s.slice(2, -2) })
    else if (s.startsWith('~~')) out.push({ type: 'del', text: s.slice(2, -2) })
    else if (s.startsWith('*')) out.push({ type: 'em', text: s.slice(1, -1) })
    else {
      // 只有 http(s) 链接才会走到这里（正则里已经限死），所以不必再防 `javascript:`
      const split = s.indexOf('](')
      out.push({ type: 'link', text: s.slice(1, split), href: s.slice(split + 2, -1) })
    }
    last = at + s.length
  }
  if (last < line.length) out.push({ type: 'text', text: line.slice(last) })
  return out
}

function renderInline(line: string, keyPrefix: string): ReactNode[] {
  return inlineTokens(line).map((t, i) => {
    const key = `${keyPrefix}-${i}`
    switch (t.type) {
      case 'code':
        return (
          <code key={key} className="rounded bg-sunken px-1 py-px font-mono text-12 text-ink-1">
            {t.text}
          </code>
        )
      case 'strong':
        return (
          <strong key={key} className="font-semibold text-ink">
            {t.text}
          </strong>
        )
      case 'em':
        return <em key={key}>{t.text}</em>
      case 'del':
        return (
          <del key={key} className="text-ink-3">
            {t.text}
          </del>
        )
      case 'link':
        return (
          <a
            key={key}
            href={t.href}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {t.text}
          </a>
        )
      default:
        // 纯文本直接还成字符串。数组里的字符串不需要 key。
        return t.text
    }
  })
}

const BULLET = /^\s*[-*·•]\s+(.*)$/

/**
 * 有序列表。两个细节都是实测出来的，放宽或收紧都会坏一边：
 *
 * · **`、` 后面不要求空格** —— 中文习惯写成 `1、甲`。最初要求 `\s+`，
 *   结果模型写的 `1、甲` 整段退化成普通段落。
 * · **序号限一到两位** —— 否则 `400、人均 400` 这种正文会被当成列表项。
 *   这是启发式：真正的列表序号不会写到三位数，而正文里的数字经常是三位以上。
 * · `.` 后面**仍然要求空格** —— `5.8km`、`2026.09` 必须留在正文里。
 */
const ORDERED = /^\s*\d{1,2}(?:\.\s+|[、）)]\s*)(.*)$/
const HEADING = /^\s{0,3}(#{1,4})\s+(.*)$/
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/

/** 这一行是不是「块的开始」。段落循环靠它刹车，否则列表会被上一段整段吃掉。 */
function startsBlock(line: string): boolean {
  return BULLET.test(line) || ORDERED.test(line) || HEADING.test(line) || RULE.test(line)
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i += 1
      continue
    }

    if (RULE.test(line)) {
      blocks.push(<hr key={key++} className="border-line" />)
      i += 1
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      // 不按 h1/h2 分级——气泡里没有版式空间容纳字号阶梯，
      // 分出来的层级只会让 195pt 宽的列看起来忽大忽小。统一成一行加粗。
      blocks.push(
        <p key={key++} className="font-semibold text-ink">
          {renderInline(heading[2], `h${key}`)}
        </p>,
      )
      i += 1
      continue
    }

    const isBullet = BULLET.test(line)
    const isOrdered = !isBullet && ORDERED.test(line)
    if (isBullet || isOrdered) {
      const items: string[] = []
      while (i < lines.length) {
        const m = isBullet ? BULLET.exec(lines[i]) : ORDERED.exec(lines[i])
        if (!m) break
        items.push(m[1])
        i += 1
      }
      const listItems = items.map((item, n) => (
        <li key={n} className="pl-0.5">
          {renderInline(item, `li${key}-${n}`)}
        </li>
      ))
      blocks.push(
        isBullet ? (
          <ul key={key++} className="flex list-outside list-disc flex-col gap-0.5 pl-3.5">
            {listItems}
          </ul>
        ) : (
          <ol key={key++} className="flex list-outside list-decimal flex-col gap-0.5 pl-3.5">
            {listItems}
          </ol>
        ),
      )
      continue
    }

    // 段落：连续的非空、且不是其他块开头的行。
    // 行与行之间**保留换行**（<br/>），顶替原来的 whitespace-pre-line。
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      para.push(lines[i])
      i += 1
    }
    const nodes: ReactNode[] = []
    para.forEach((l, n) => {
      if (n) nodes.push(<br key={`br${n}`} />)
      nodes.push(...renderInline(l, `p${key}-${n}`))
    })
    blocks.push(
      <p key={key++} className="break-words">
        {nodes}
      </p>,
    )
  }

  if (!blocks.length) return null

  // 块间距交给 flex gap，而不是给每个块写 mt —— 这样首块不会被顶出多余的上边距，
  // 末尾块也不会多留一条（气泡的 py-3 已经给了内边距）。
  return <div className="flex flex-col gap-1.5">{blocks}</div>
}
