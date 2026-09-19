/**
 * 对话历史镜像的浏览器侧接入层：拉历史列表、整段覆盖写镜像。
 *
 * 与后端 apps/api/src/index.ts 的 `/api/conversations` 路由是同一套协议的两端。
 * 这里只碰 visitor id，**永不碰 API Key**，与 openhex.ts 的边界一致。
 *
 * 同步是 best-effort：后端没起 / 网络失败都不该卡住对话本身 —— 丢一次镜像
 * 最多是历史列表少一段，下一轮收尾又会整段重写补上。
 */

import { getVisitorId } from './openhex'

export interface ConversationSummary {
  id: string
  title: string
  message_count: number
  updated_at: number
}

const CONVERSATIONS_ENDPOINT = '/api/conversations'

/** 拉当前访客的对话列表（最近更新在前）。失败静默返回空列表。 */
export async function listConversations(): Promise<ConversationSummary[]> {
  try {
    const res = await fetch(`${CONVERSATIONS_ENDPOINT}?visitor=${encodeURIComponent(getVisitorId())}`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { conversations?: ConversationSummary[] }
    return data.conversations ?? []
  } catch {
    return []
  }
}

/** 同步一条消息的形状 —— 与 hook 的 ChatMessage 结构兼容，这里只挑需要的字段。 */
export interface MirrorMessage {
  role: string
  text: string
  createdAt?: number
}

/** 整段覆盖写某段对话的镜像。失败静默吞掉（best-effort）。 */
export async function saveConversation(id: string, messages: MirrorMessage[]): Promise<void> {
  try {
    await fetch(`${CONVERSATIONS_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        visitor: getVisitorId(),
        messages: messages.map((m) => ({ role: m.role, text: m.text, created_at: m.createdAt })),
      }),
    })
  } catch {
    // 镜像写失败不影响对话，静默即可
  }
}
