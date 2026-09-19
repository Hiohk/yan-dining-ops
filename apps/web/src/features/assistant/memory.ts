/**
 * 画像的浏览器侧接入层：拉取 / 保存画像，以及注入段与剥离用的定界格式。
 *
 * 与后端 apps/api/src/memory.ts 是同一套协议的两端：
 *   - `MEMORY_BLOCK_RE` 必须和后端 `buildInjection` 的 `[用户画像] … [/用户画像]`
 *     定界一致 —— 改任意一端都要同步另一端，否则注入的画像会漏到用户气泡里。
 *   - `PREDICATE_LABELS` 与后端那张表一致，ProfilePage 靠它把 predicate 翻回中文。
 *
 * 这里只碰 visitor id（本地随机生成的访客标识），**永不碰 API Key**，
 * 与 openhex.ts 的边界一致。
 */

import { getVisitorId } from './openhex'

/** 注入段的定界：ChatPage 用它把画像从首条用户消息里剥掉，用户不可见。 */
export const MEMORY_BLOCK_RE = /\[用户画像\][\s\S]*?\[\/用户画像\]\s*/

export interface MemoryFact {
  subject: string
  predicate: string
  value: string
  source: string
}

export const PREDICATE_LABELS: Record<string, string> = {
  cuisine: '菜系偏好',
  dietary: '口味 / 忌口',
  area: '常用区域',
  restaurant: '常用餐厅',
  contact: '常用对象',
}

/** 反向映射：ProfilePage 保存时把「我的偏好」四行的中文标签翻回 predicate。 */
export const LABEL_TO_PREDICATE: Record<string, string> = Object.fromEntries(
  Object.entries(PREDICATE_LABELS).map(([predicate, label]) => [label, predicate]),
)

const MEMORY_ENDPOINT = '/api/memory'

export interface Contact {
  name: string
  role: string
  notes: string
}

export interface MemorySnapshot {
  facts: MemoryFact[]
  contacts: Contact[]
  injection: string
}

/**
 * 拉取当前访客的画像。**失败静默返回空画像**：注入是 best-effort，
 * 后端没起 / 网络失败都不该卡住用户发消息 —— 画像缺失最多是「Agent 不记得」，
 * 比「一句话都发不出去」轻得多。
 */
export async function fetchMemory(): Promise<MemorySnapshot> {
  try {
    const res = await fetch(`${MEMORY_ENDPOINT}?visitor=${encodeURIComponent(getVisitorId())}`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return { facts: [], contacts: [], injection: '' }
    const data = (await res.json()) as { facts?: MemoryFact[]; contacts?: Contact[]; injection?: string }
    return { facts: data.facts ?? [], contacts: data.contacts ?? [], injection: data.injection ?? '' }
  } catch {
    return { facts: [], contacts: [], injection: '' }
  }
}

/** 保存画像事实（整体替换 profile 来源）。失败抛错，交给「我的」页呈现。 */
export async function saveFacts(
  facts: Array<{ subject: string; predicate: string; value: string }>,
): Promise<void> {
  const res = await fetch(MEMORY_ENDPOINT, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visitor: getVisitorId(), facts }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message ?? `保存记忆失败（HTTP ${res.status}）`)
  }
}
