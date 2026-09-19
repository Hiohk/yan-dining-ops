/**
 * OpenHex 接入层：访客身份 + 会话令牌。
 *
 * 这一层只做两件事，且**只碰会话令牌，永不碰 API Key**：
 *
 *   1. 给当前浏览器一个稳定的访客 id（localStorage）。它会被后端拼成
 *      `sp_user_ref` 交给平台 —— 平台据此认定「这是同一个人」，
 *      所以刷新、切页、隔天再来，看到的都是同一段对话。
 *      这个值一变，平台就当成了新成员，历史对话再也找不回来。
 *
 *   2. 向后端换一张短时令牌（JWT）交给 SDK。令牌本身不进 localStorage ——
 *      它放内存里就够了，刷新页面重新换一张，泄漏面更小。
 *
 * ⚠️ 这里**不能**出现任何 `mysta_…` / `sk_…`。它们等同于账号 / 工作区的全部权限，
 *    打包进前端产物就等于公开。浏览器的凭据只有会话令牌这一种，
 *    由 `apps/api` 用工作区 Key 在服务端签发。
 */

const VISITOR_STORAGE_KEY = 'lto.openhex.visitor'
const TOKEN_ENDPOINT = '/api/openhex/token'

/** 提前量：令牌还剩不到这么久就换新的，避免请求卡在过期边界上 */
const REFRESH_AHEAD_MS = 60_000

/**
 * Agent ID 是 UUID，**不是密钥**，可以出现在前端（SDK 文档「鉴权」页明确说明）。
 * 浏览器读不到服务器的环境变量，所以它只能由构建期注入。
 */
export const OPENHEX_AGENT_ID = (import.meta.env.VITE_OPENHEX_AGENT_ID ?? '').trim()

export const isOpenhexConfigured = OPENHEX_AGENT_ID.length > 0

/** localStorage 不可用时的兜底（隐私模式、禁用存储）。仅存活于当前页面会话。 */
let memoryVisitorId: string | null = null

/**
 * 32 位十六进制的随机 id（后端按 `^[A-Za-z0-9_-]{6,64}$` 校验，这个形状天然合规）。
 *
 * 刻意**不用 `crypto.randomUUID()`** —— 它被规范限制在**安全上下文**才存在
 * （HTTPS 或 localhost），用明文 HTTP 访问服务器 IP 时它是 `undefined`，调用直接抛
 * 「crypto.randomUUID is not a function」。实测踩到过：部署到 `http://<ip>:8090` 后
 * 一发消息就报这个错，而 localhost 开发永远复现不出来。
 * `crypto.getRandomValues` **没有**这个限制，所以用它。
 *
 * ⚠️ 这个函数**必须永不抛异常**：调用它的 `getVisitorId` 在 catch 分支里还会再调一次，
 * 它一抛就直接穿透成未捕获异常（原来那版正是如此 —— 本意是兜底的 catch 反而成了放大器）。
 */
function randomId(): string {
  const bytes = new Uint8Array(16)
  const c = globalThis.crypto
  if (typeof c?.getRandomValues === 'function') {
    c.getRandomValues(bytes)
  } else {
    // 极老的 WebView 里 getRandomValues 也可能没有。这个 id 只是「同一个访客」的标识，
    // 不是凭据，不需要密码学强度，退到 Math.random 可以接受。
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY)
    if (existing) return existing
    const created = randomId()
    localStorage.setItem(VISITOR_STORAGE_KEY, created)
    return created
  } catch {
    // 存不进去也不能抛 —— 抛了整个对话页就白屏了。
    // 退化的代价只是「刷新后变成新成员、丢掉历史」，比打不开好得多。
    memoryVisitorId ??= randomId()
    return memoryVisitorId
  }
}

interface CachedToken {
  token: string
  /** 毫秒时间戳；没解析出来时为 0，等于不缓存 */
  expiresAt: number
}

/**
 * `expires_at` 后端已归一成毫秒数，这里仍然同时容忍 ISO 字符串 ——
 * 网关和前端是两个进程，多写这五行换掉一类「突然不再刷新令牌」的隐性故障。
 */
function parseExpiry(value: unknown): number {
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? 0 : ms
  }
  return 0
}

async function fetchToken(): Promise<CachedToken> {
  const url = `${TOKEN_ENDPOINT}?visitor=${encodeURIComponent(getVisitorId())}`

  let res: Response
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch {
    // fetch 只在网络层失败时抛，最常见的原因就是后端没起
    throw new Error('连不上会话令牌服务。开发环境请确认 `pnpm dev:api` 已启动。')
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message ?? `会话令牌签发失败（HTTP ${res.status}）`)
  }

  const data = (await res.json()) as { token?: string; expires_at?: unknown }
  if (!data.token) throw new Error('会话令牌响应里没有 token 字段')
  return { token: data.token, expiresAt: parseExpiry(data.expires_at) }
}

let cached: CachedToken | null = null
let inflight: Promise<CachedToken> | null = null

/**
 * 交给 `useOpenhexChat` 的 `getToken`：**每次请求前都会被调用**，
 * 所以这里必须廉价。命中缓存就直接返回，快到期的才真去换。
 *
 * 并发合并（inflight）不能省：首屏同时挂载的组件都会来要令牌，
 * 没有它就会同时打出好几发请求，而每一发都会在平台侧签一张新令牌。
 */
export function getOpenhexToken(): Promise<string> {
  if (cached && cached.expiresAt - Date.now() > REFRESH_AHEAD_MS) {
    return Promise.resolve(cached.token)
  }

  inflight ??= fetchToken().finally(() => {
    // finally 的回调在微任务里跑，此时 inflight 已经赋好值，清空是安全的
    inflight = null
  })

  return inflight.then((fresh) => {
    cached = fresh
    return fresh.token
  })
}
