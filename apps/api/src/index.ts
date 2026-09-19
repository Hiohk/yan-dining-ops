/**
 * 会话令牌网关 —— 本项目唯一的后端进程。
 *
 * 它只做一件事：**用工作区 API Key 换一张会话令牌**，交给浏览器。
 *
 * 为什么必须有这一层（SDK 文档「鉴权」页反复强调的硬约束）：
 *   - 个人 API Key（`mysta_…`）等同于账号权限，工作区 API Key（`sk_…`）等同于工作区权限；
 *     两者只要进了前端产物就等于公开 —— 浏览器、小程序包、App 安装包全部可被逆向。
 *   - 客户端只允许拿「会话令牌」（JWT），它代表工作区里的**某一个成员**，
 *     泄漏了也只影响这一个成员，且到期即失效。
 * 所以密钥永远留在这个进程里，前端拿到的只有 token。
 *
 * 刻意不引任何 Web 框架：这里只有一个路由，`node:http` 足够，
 * 少一层依赖就少一处将来要跟着 SDK 一起升级的东西。
 * 长连接（Agent 的 SSE）**不经过这里** —— 前端拿令牌直连 OpenHex 平台。
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { OpenhexClient } from '@openhex-ai/agent-sdk'
import { getContacts, getFacts, listConversations, replaceFacts, saveConversation, type MessageInput } from './db.js'
import { buildInjection, isValidVisitor, parseFactInput, stripInjection } from './memory.js'

// ── 环境变量 ─────────────────────────────────────────────

interface Config {
  key: string
  slug: string
  port: number
  /**
   * 监听地址。默认 `127.0.0.1`（本地开发：只有 vite 代理能到，不对外暴露）。
   * 容器里必须由 compose 注入 `HOST=0.0.0.0` —— 容器内的 127.0.0.1 只是**自己那个
   * 网络命名空间**的回环地址，同网络的 nginx 容器永远连不上，现象是 502。
   */
  host: string
  /** 平台 API 地址；未设置时用 SDK 默认的 https://api.openhex.tech */
  baseUrl?: string
}

/**
 * 配置校验**必须跑在 `new OpenhexClient` 之前**。
 *
 * 实测踩过：SDK 的构造函数在没有 apiKey 时会直接抛 `AuthenticationError`，
 * 于是用户看到的是一段 SDK 内部堆栈，而不是「你少填了一个变量」。
 * 所以这里先校验、后建客户端 —— 顺序本身是这段代码的正确性条件。
 *
 * 顺带一提，缺失配置要在**启动时**就失败，而不是等第一个用户点进来才 500：
 * 后者会被当成前端 bug 排查半天。
 */
function loadConfig(): Config {
  // Node 20.12+ 内置 .env 解析，不引 dotenv。文件不存在时 loadEnvFile 会抛，
  // 直接忽略即可 —— 生产环境通常是真正的环境变量而不是文件。
  try {
    process.loadEnvFile(new URL('../.env', import.meta.url))
  } catch {
    // 没有 .env 文件属正常情况，下面统一校验
  }

  const key = process.env.OPENHEX_WORKSPACE_KEY
  const slug = process.env.OPENHEX_WORKSPACE_SLUG

  const missing: string[] = []
  if (!key) missing.push('OPENHEX_WORKSPACE_KEY')
  if (!slug) missing.push('OPENHEX_WORKSPACE_SLUG')

  // 条件写成 `!key || !slug`（而不是 `missing.length`）才能让 TS 收窄两个变量 ——
  // missing 是个数组，编译器不会从它的长度反推出哪个变量非空。
  if (!key || !slug) {
    console.error(
      [
        '',
        `✗ 缺少环境变量：${missing.join('、')}`,
        '',
        '  在 apps/api/.env 里填好（可复制 apps/api/.env.example）：',
        '    OPENHEX_WORKSPACE_KEY=sk_…    # 工作区 API Key，不是 mysta_ 开头的个人 Key',
        '    OPENHEX_WORKSPACE_SLUG=…      # 工作区 slug',
        '',
        '  注意：**个人 API Key（mysta_…）签发不了会话令牌**。',
        '  会话令牌只接受工作区 API Key。获取方式：',
        '    ① 用个人 Key 调 GET /api/v2/workspaces 拿 slug（没有就 POST 建一个）',
        '    ② POST /api/v2/workspaces/{slug}/api-keys 签发 sk_…',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }

  // 混淆两种 Key 是最容易犯的错，而且上游的报错（401 workspace API key required）
  // 完全看不出问题出在 Key 的类型上，所以在这里提前把话说明白。
  if (key.startsWith('mysta_')) {
    console.error(
      '\n✗ OPENHEX_WORKSPACE_KEY 填的是个人 API Key（mysta_…），但签发会话令牌只接受工作区 API Key（sk_…）。\n',
    )
    process.exit(1)
  }

  // 覆盖平台地址：给自建/预发环境用（SDK 文档的 baseUrl 选项），
  // 同时它也是**这个进程唯一能被端到端测试**的原因 —— 默认指向线上时，
  // 没有真实 sk_… 就一步都验不了，而这段代码的职责恰好就是把凭据倒来倒去。
  //
  // ⚠️ 凭据会跟着 baseUrl 走（SDK 明确只把凭据发往 baseUrl 所在的域名），
  //    所以这个变量指向哪，工作区 Key 就交给谁 —— 只在你自己的环境里设置它。
  const baseUrl = process.env.OPENHEX_API_BASE?.trim().replace(/\/+$/, '')

  return {
    key,
    slug,
    port: Number(process.env.PORT ?? 8000),
    host: process.env.HOST?.trim() || '127.0.0.1',
    baseUrl: baseUrl || undefined,
  }
}

const config = loadConfig()

// ── 令牌缓存 ─────────────────────────────────────────────
// 同一个访客在令牌有效期内反复刷新页面不该反复打平台接口；
// 同时把并发请求合并（两个组件同时挂载只发一次请求）。
// 停用成员不会吊销已签发的令牌，所以这里只按时间判断，不做吊销感知 ——
// 短 TTL + 前端到期换新才是这里的防线。
const TTL_SECONDS = 1800
const REFRESH_AHEAD_MS = 5 * 60 * 1000

interface CachedToken {
  token: string
  /** 毫秒时间戳；解析失败时为 0，等于不缓存 */
  expiresAt: number
}

const cache = new Map<string, CachedToken>()
const inflight = new Map<string, Promise<CachedToken>>()

// config 已在模块顶部校验过，这里拿到的必然是可用的工作区凭据
const client = new OpenhexClient({ apiKey: config.key, baseUrl: config.baseUrl })
const workspace = client.workspace(config.slug)

/**
 * `expires_at` 是 ISO-8601 字符串（文档明确），但这里同时容忍 epoch 秒/毫秒 ——
 * 一旦平台改成时间戳，解析失败会让缓存永久命中错误值，不如多写这五行。
 */
function parseExpiry(value: unknown): number {
  if (typeof value === 'number') {
    // 10 位数是秒，13 位数是毫秒
    return value < 1e12 ? value * 1000 : value
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? 0 : ms
  }
  return 0
}

async function mintToken(visitor: string): Promise<CachedToken> {
  const cached = cache.get(visitor)
  if (cached && cached.expiresAt - Date.now() > REFRESH_AHEAD_MS) return cached

  const running = inflight.get(visitor)
  if (running) return running

  const task = (async (): Promise<CachedToken> => {
    const { token, expires_at } = await workspace.startVisitorSession({
      // sp_user_ref 必须稳定：同一个人 → 同一个成员 → 同一段对话。
      // 变了就是新成员，历史对话也找不回来了，所以前端把它存进 localStorage。
      sp_user_ref: `web_${visitor}`,
      display_name: '网站访客',
      ttl_seconds: TTL_SECONDS,
    })
    const entry: CachedToken = { token, expiresAt: parseExpiry(expires_at) }
    // expiresAt=0 表示没解析出有效期，那就别缓存（宁可多请求，不可发过期令牌）
    if (entry.expiresAt > Date.now()) cache.set(visitor, entry)
    return entry
  })()

  inflight.set(visitor, task)
  try {
    return await task
  } finally {
    inflight.delete(visitor)
  }
}

// ── HTTP ─────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/** 只要 visitor 参数，所以手写解析即可，不引 URL 之外的东西 */
function readVisitor(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const visitor = url.searchParams.get('visitor')?.trim()
  if (!visitor) return null
  // sp_user_ref 会拼进平台侧标识，限制字符集避免奇怪的注入面
  return /^[A-Za-z0-9_-]{6,64}$/.test(visitor) ? visitor : null
}

/**
 * 手写读取 JSON body。只有 `PUT /api/memory`、`PUT /api/conversations/:id` 需要请求体，
 * 所以照旧不引框架，`data`/`end` 累积 + JSON.parse 足够。
 * 默认 64KB 是给画像事实的安全边界；对话整段覆盖可能很长，所以允许调用方放宽。
 */
function readJsonBody(req: IncomingMessage, maxBytes = 64 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let aborted = false

    req.on('data', (chunk: Buffer) => {
      if (aborted) return
      size += chunk.length
      if (size > maxBytes) {
        aborted = true
        reject(new Error(`请求体过大（上限 ${maxBytes} 字节）`))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (aborted) return
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('JSON 解析失败'))
      }
    })
    req.on('error', reject)
  })
}

// 对话镜像的入参校验边界。整段覆盖体积大，所以上限给得比画像事实宽很多。
const MAX_MESSAGES = 2000
const MAX_MESSAGE_LEN = 200_000
const MAX_TITLE_LEN = 30
const CONVERSATION_ROLES = new Set(['user', 'assistant', 'system'])

/** 校验并规整 PUT /api/conversations/:id 的 messages：非数组 / 非法 role / 超长都返回原因。 */
function parseMessages(raw: unknown): MessageInput[] | { error: string } {
  if (!Array.isArray(raw)) return { error: 'messages 必须是数组' }
  if (raw.length > MAX_MESSAGES) return { error: `messages 最多 ${MAX_MESSAGES} 条` }

  const out: MessageInput[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return { error: 'messages 每项必须是对象' }
    const { role, text, created_at } = item as Record<string, unknown>
    if (typeof role !== 'string' || !CONVERSATION_ROLES.has(role)) return { error: `不支持的 role: ${String(role)}` }
    if (typeof text !== 'string') return { error: 'text 必须是字符串' }
    if (text.length > MAX_MESSAGE_LEN) return { error: `单条消息超长（上限 ${MAX_MESSAGE_LEN} 字）` }
    out.push({ role, text, created_at: typeof created_at === 'number' ? created_at : undefined })
  }
  return out
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, workspace: config.slug })
    return
  }

  if (url.pathname === '/api/openhex/token') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' })
      return
    }
    const visitor = readVisitor(req)
    if (!visitor) {
      sendJson(res, 400, { error: 'invalid_visitor', message: '缺少或不合法的 visitor 参数' })
      return
    }
    mintToken(visitor)
      .then(({ token, expiresAt }) => sendJson(res, 200, { token, expires_at: expiresAt }))
      .catch((err: unknown) => {
        // 把平台错误如实透出（401/403 的原因对排查很关键），但不泄漏任何 Key
        const status = (err as { status?: number }).status
        const message = err instanceof Error ? err.message : String(err)
        console.error('[openhex] 签发会话令牌失败：', message)
        sendJson(res, status && status >= 400 && status < 600 ? 502 : 500, {
          error: 'token_mint_failed',
          message,
        })
      })
    return
  }

  if (url.pathname === '/api/memory') {
    // 读画像：返回结构化事实 + 一段拼好、可直接注入的文本。
    // 注入文本放后端拼，前端就只管「拿过来、拼上去」，格式只有这一处定义。
    if (req.method === 'GET') {
      const visitor = readVisitor(req)
      if (!visitor) {
        sendJson(res, 400, { error: 'invalid_visitor', message: '缺少或不合法的 visitor 参数' })
        return
      }
      const facts = getFacts(visitor)
      const contacts = getContacts()
      sendJson(res, 200, { visitor, facts, contacts, injection: buildInjection(facts, contacts) })
      return
    }

    // 写画像：「我的」页保存偏好时，用一组事实整体替换该访客 profile 来源的事实。
    if (req.method === 'PUT') {
      readJsonBody(req)
        .then((body) => {
          const { visitor, facts } = (body ?? {}) as { visitor?: unknown; facts?: unknown }
          if (typeof visitor !== 'string' || !isValidVisitor(visitor)) {
            sendJson(res, 400, { error: 'invalid_visitor', message: '缺少或不合法的 visitor' })
            return
          }
          const parsed = parseFactInput(facts)
          if ('error' in parsed) {
            sendJson(res, 400, { error: 'invalid_facts', message: parsed.error })
            return
          }
          const count = replaceFacts(visitor, parsed)
          sendJson(res, 200, { ok: true, count })
        })
        .catch((err: unknown) => {
          sendJson(res, 400, { error: 'invalid_body', message: err instanceof Error ? err.message : String(err) })
        })
      return
    }

    sendJson(res, 405, { error: 'method_not_allowed' })
    return
  }

  // 对话历史镜像：列表 + 整段覆盖写。正文的权威来源仍是 OpenHex 平台，
  // 这里只存一份自己库里的镜像，供历史列表 / 自动恢复用。
  if (url.pathname === '/api/conversations') {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' })
      return
    }
    const visitor = readVisitor(req)
    if (!visitor) {
      sendJson(res, 400, { error: 'invalid_visitor', message: '缺少或不合法的 visitor 参数' })
      return
    }
    sendJson(res, 200, { conversations: listConversations(visitor) })
    return
  }

  if (url.pathname.startsWith('/api/conversations/')) {
    if (req.method !== 'PUT') {
      sendJson(res, 405, { error: 'method_not_allowed' })
      return
    }
    const id = decodeURIComponent(url.pathname.slice('/api/conversations/'.length))
    // 会话 id 来自 OpenHex，格式由平台定，这里只做「非空且字符集可写进路径」的最低校验。
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
      sendJson(res, 400, { error: 'invalid_conversation_id', message: '不合法的会话 id' })
      return
    }
    readJsonBody(req, 1024 * 1024)
      .then((body) => {
        const { visitor, messages } = (body ?? {}) as { visitor?: unknown; messages?: unknown }
        if (typeof visitor !== 'string' || !isValidVisitor(visitor)) {
          sendJson(res, 400, { error: 'invalid_visitor', message: '缺少或不合法的 visitor' })
          return
        }
        const parsed = parseMessages(messages)
        if ('error' in parsed) {
          sendJson(res, 400, { error: 'invalid_messages', message: parsed.error })
          return
        }
        // 标题取首条用户消息（剥掉画像注入块）截断；找不到用户消息就用空串。
        const firstUser = parsed.find((m) => m.role === 'user')
        const title = firstUser ? stripInjection(firstUser.text).slice(0, MAX_TITLE_LEN) : ''
        saveConversation(visitor, { id, title, messages: parsed })
        sendJson(res, 200, { ok: true, count: parsed.length })
      })
      .catch((err: unknown) => {
        sendJson(res, 400, { error: 'invalid_body', message: err instanceof Error ? err.message : String(err) })
      })
    return
  }

  sendJson(res, 404, { error: 'not_found' })
})

server.listen(config.port, config.host, () => {
  // 绑 0.0.0.0 时别把地址打印成 127.0.0.1 —— 那样日志会让人以为「只在本机」，
  // 与「服务到底对谁可见」正好相反，排查时容易往错的方向找。
  const host = config.host === '0.0.0.0' ? '0.0.0.0（所有网卡）' : config.host
  console.log(`[lto-api] 会话令牌网关已启动 → http://${host}:${config.port}`)
  console.log(`[lto-api] 工作区：${config.slug}`)
  // 覆盖了平台地址就明说 —— 否则「怎么聊出来的回复不是我的 Agent」会很难查
  if (config.baseUrl) console.log(`[lto-api] ⚠️ 平台地址已被覆盖为：${config.baseUrl}`)
})
