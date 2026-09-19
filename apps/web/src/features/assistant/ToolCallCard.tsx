import { ChevronDown, Wrench } from 'lucide-react'
import { CARD_KINDS, type AnyCard } from '@lto/cards'
import type { ChatToolCall } from '@openhex-ai/agent-sdk/react'
import { CardRenderer, type PromptHandler } from './cards/CardRenderer'

/**
 * 把 OpenHex 的**工具调用**翻译成界面。
 *
 * 领域卡片不再由前端脚本产生，而是 Agent 调用 MCP 工具的结果：工具的入参就是
 * 一张卡片（`{ v, id, kind, … }`），所以这里的映射规则只有一条 ——
 *
 *   **只认 `input.kind`，不认工具名。**
 *
 * 为什么按 kind 而不按工具名分发：工具名是平台侧的配置，改个名字、加个前缀、
 * 或者同一个 kind 由多个工具产出，前端都不该跟着改。而 `kind` 是卡片协议的一部分
 * （`@lto/cards` 的判别联合），是前后端已经约定好的词汇表。
 *
 * 两条降级纪律（对应技术方案 §8.3 决策三）：
 *   - 不是卡片形状的调用 **不丢弃**，渲染成一条可展开的轻量记录（工具名 + 入参）
 *   - 是卡片但协议版本高于前端认识的版本，交给 `CardRenderer` 走它自己的降级分支
 *     （摊平 payload + **保留全部 actions**），不白屏
 */

/** 输入是卡片吗？只做「是不是这个形状」的判断，版本校验交给 CardRenderer */
function asAnyCard(input: Record<string, unknown>, fallbackId: string): AnyCard | null {
  const { kind, v, id } = input
  if (typeof kind !== 'string' || !CARD_KINDS.has(kind)) return null
  if (typeof v !== 'number') return null
  // id 缺失不影响渲染（React key 由调用方给），但卡片协议要求它存在，
  // 而 ProgressCardView 这类视图会拿它做动画键，所以补一个稳定的回退值。
  return { ...input, id: typeof id === 'string' && id ? id : fallbackId } as unknown as AnyCard
}

export function ToolCallCard({
  toolCall,
  fallbackId,
  onPrompt,
}: {
  toolCall: ChatToolCall
  /** 卡片自身没带 id 时用的稳定标识（由调用方按工具调用位置生成） */
  fallbackId: string
  onPrompt: PromptHandler
}) {
  const card = asAnyCard(toolCall.input ?? {}, fallbackId)
  if (card) return <CardRenderer card={card} onPrompt={onPrompt} />
  return <ToolCallRow toolCall={toolCall} />
}

/**
 * 非卡片的工具调用。**必须渲染而不是过滤掉** —— 过滤掉用户就完全看不到
 * Agent 干了什么；但也不能像卡片那样占满宽度，一次对话里这类调用可能有几十条，
 * 会把正文淹没。所以折成一行：平时只显示工具名，想看细节再展开。
 *
 * 展开用原生 `<details>`，不引状态：这类「看一眼就走」的内容不值得为它维护
 * 一份 expandedIds 状态，而且原生元素天生带键盘可达性。
 */
function ToolCallRow({ toolCall }: { toolCall: ChatToolCall }) {
  return (
    <details className="group rounded-card bg-sunken px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-2xs text-ink-3">
        <Wrench className="size-3 shrink-0" strokeWidth={2} />
        <span className="min-w-0 flex-1 truncate">调用工具：{toolCall.name}</span>
        <ChevronDown
          className="size-3 shrink-0 transition-transform group-open:rotate-180"
          strokeWidth={2}
        />
      </summary>
      <pre className="mt-1.5 max-h-40 overflow-auto font-mono text-2xs whitespace-pre-wrap break-all text-ink-2">
        {formatInput(toolCall.input)}
      </pre>
    </details>
  )
}

/** 循环引用 / 超长二进制之类会把 JSON.stringify 打崩，兜住它 */
function formatInput(input: unknown): string {
  try {
    return JSON.stringify(input ?? {}, null, 2) ?? '（无参数）'
  } catch {
    return '（参数无法序列化）'
  }
}
