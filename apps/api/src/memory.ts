/**
 * 画像的「语义」层：predicate 白名单、入参校验、注入文本拼装。
 *
 * 与存储层（db.ts）分开，是因为「哪些事实是合法的」「事实怎么变成给 Agent 看的
 * 一段话」属于业务规则，不随存储引擎变化。校验集中在入口，让写进库里的数据
 * 只剩一条进入路径。
 */

import type { Contact, MemoryFact, MemoryFactInput } from './db.js'

/** 画像里允许出现的事实类型。不在表里的会被拒绝，避免往里塞任意字符串。 */
const PREDICATES = new Set(['cuisine', 'dietary', 'area', 'restaurant', 'contact'])

/** predicate → 注入文本里的中文标签。与前端 memory.ts 里的同一张表保持一致。 */
export const PREDICATE_LABELS: Record<string, string> = {
  cuisine: '菜系偏好',
  dietary: '口味 / 忌口',
  area: '常用区域',
  restaurant: '常用餐厅',
  contact: '常用对象',
}

/** 本人偏好的固定展示顺序 —— 顺序不固定会让每次注入的文本都变，Agent 看到的不稳定。 */
const SELF_PREDICATE_ORDER = ['cuisine', 'dietary', 'area', 'restaurant'] as const

const MAX_VALUE_LEN = 200
const MAX_FACTS = 100

/** visitor 字符集与 index.ts 里 readVisitor 的规则一致，两处不能各写一套。 */
export function isValidVisitor(visitor: string): boolean {
  return /^[A-Za-z0-9_-]{6,64}$/.test(visitor)
}

export type FactParseResult = MemoryFactInput[] | { error: string }

/** 校验并规整 PUT 进来的 facts：非数组 / 非法字段 / 超长都返回带原因的 error。 */
export function parseFactInput(raw: unknown): FactParseResult {
  if (!Array.isArray(raw)) return { error: 'facts 必须是数组' }
  if (raw.length > MAX_FACTS) return { error: `facts 最多 ${MAX_FACTS} 条` }

  const out: MemoryFactInput[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return { error: 'facts 每项必须是对象' }
    const { subject, predicate, value } = item as Record<string, unknown>
    if (typeof subject !== 'string' || subject.trim() === '') return { error: 'subject 必须是非空字符串' }
    if (typeof predicate !== 'string' || !PREDICATES.has(predicate)) {
      return { error: `不支持的 predicate: ${String(predicate)}` }
    }
    if (typeof value !== 'string' || value.trim() === '') return { error: 'value 必须是非空字符串' }
    if (value.length > MAX_VALUE_LEN) return { error: `value 超长（上限 ${MAX_VALUE_LEN} 字）` }
    out.push({ subject: subject.trim(), predicate, value: value.trim() })
  }
  return out
}

/**
 * 把事实拼成给 Agent 看的一段话。空画像返回空串（前端据此决定是否注入）。
 *
 * 格式用 [用户画像] … [/用户画像] 定界，前端注入后渲染用户气泡时靠它剥掉，
 * 所以两端必须共用这个格式 —— 改这里要同步改前端 memory.ts 的 MEMORY_BLOCK_RE。
 *
 * 联系人走独立的 contacts 表（全局公司知识），不再是 memory_facts 里的
 * subject='contact' 事实 —— 那条路已废弃，联系人只从这里供给。
 */
export function buildInjection(facts: MemoryFact[], contacts: Contact[]): string {
  const lines: string[] = []
  for (const predicate of SELF_PREDICATE_ORDER) {
    const values = facts
      .filter((f) => f.subject === 'self' && f.predicate === predicate)
      .map((f) => f.value)
    if (values.length > 0) lines.push(`${PREDICATE_LABELS[predicate]}：${values.join(' · ')}`)
  }

  if (contacts.length > 0) {
    lines.push(`${PREDICATE_LABELS.contact}：`)
    for (const c of contacts) lines.push(`${c.name}（${c.role}）：${c.notes}`)
  }

  if (lines.length === 0) return ''
  return `[用户画像]\n${lines.join('\n')}\n[/用户画像]\n`
}

/** 注入块的定界，与前端 memory.ts 的 MEMORY_BLOCK_RE 一致（改任意一端都要同步另一端）。 */
const MEMORY_BLOCK_RE = /\[用户画像\][\s\S]*?\[\/用户画像\]\s*/

/** 剥掉消息文本里的注入块。用于从首条用户消息派生对话标题，避免标题里冒出画像原文。 */
export function stripInjection(text: string): string {
  return text.replace(MEMORY_BLOCK_RE, '').trim()
}
