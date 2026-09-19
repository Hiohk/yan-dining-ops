#!/usr/bin/env node
/**
 * 一次性引导：用**个人 API Key** 换出「工作区 API Key + slug」，直接写进 apps/api/.env。
 *
 * 对应官方文档 /sdk/workspaces「第 1 步：准备工作区和工作区 API Key」的三条 curl。
 * 之所以包成脚本而不是让你手搓三条命令 + 手拼 .env，是因为这一步有两个只能踩一次的坑：
 *
 *   ① 签发接口返回的 `token`（sk_…）**只在这一次完整返回**，平台只存哈希。
 *      粘错一次或忘了存，就只能吊销重签 —— 脚本直接落盘，不给这个失误留窗口。
 *   ② 三种凭据的前缀很容易混（mysta_ / sk_ / JWT），而填错的报错完全看不出问题
 *      出在前缀上（网关那边也吃过这个亏，见 src/index.ts 的 mysta_ 检查）。
 *      这里在发出任何请求前就把前缀校验掉。
 *
 * 这个脚本读的是**个人** Key（mysta_…），和网关读的**工作区** Key（sk_…）是两把不同的钥匙：
 * 个人 Key 能签工作区 Key，工作区 Key 签不了工作区 Key。所以它只跑一次，不是启动流程的一部分。
 *
 * 用法（个人 Key 从环境变量进，不要写进任何文件）：
 *   OPENHEX_API_KEY=mysta_... pnpm --filter @lto/api bootstrap -- --slug=your-workspace
 * 已有工作区、只想再签一把 Key：
 *   OPENHEX_API_KEY=mysta_... pnpm --filter @lto/api bootstrap
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const API_BASE = (process.env.OPENHEX_API_BASE ?? 'https://api.openhex.tech').replace(/\/+$/, '')
const ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url))

// ── 参数 ─────────────────────────────────────────────────
// 手写解析：一共四个开关，为此引 commander 不划算（和 src/index.ts 不引 Web 框架同一个理由）。
const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [k, ...rest] = raw.replace(/^--/, '').split('=')
    return [k, rest.join('=') || 'true']
  }),
)
const FORCE = args.has('force')
const DRY_RUN = args.has('dry-run')
const WANT_SLUG = args.get('slug')
const LABEL = args.get('label') ?? 'web-backend'

function die(message, hint) {
  console.error(`\n✗ ${message}`)
  if (hint) console.error(`\n  ${hint}`)
  console.error()
  process.exit(1)
}

// ── 凭据校验（在网络请求之前）─────────────────────────────
const personalKey = process.env.OPENHEX_API_KEY?.trim()
if (!personalKey) {
  die(
    '缺少 OPENHEX_API_KEY。',
    [
      '这一步要的是**个人** API Key（在 app.openhex.tech 的 设置 → API Key 创建），',
      '不是工作区 Key。用环境变量传，别写进文件：',
      '',
      '  OPENHEX_API_KEY=mysta_... pnpm --filter @lto/api bootstrap -- --slug=your-workspace',
    ].join('\n  '),
  )
}
// 前缀校验放在发请求前：401 的报错分不出「Key 填错」和「Key 用错类型」，
// 而这里只要看一眼前缀就能定死。
if (personalKey.startsWith('sk_')) {
  die(
    'OPENHEX_API_KEY 填的是工作区 Key（sk_…）。',
    '这一步要用**个人** Key（mysta_…）来签发工作区 Key —— 工作区 Key 签不了工作区 Key。',
  )
}
if (!personalKey.startsWith('mysta_')) {
  die(
    `OPENHEX_API_KEY 不像个人 API Key（应以 mysta_ 开头，实际是 "${personalKey.slice(0, 8)}…"）。`,
    '个人 Key 在 app.openhex.tech 的 设置 → API Key 创建。',
  )
}

// ── HTTP ─────────────────────────────────────────────────
async function call(method, path, body) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${personalKey}`,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (err) {
    die(`连不上 ${API_BASE}：${err instanceof Error ? err.message : String(err)}`)
  }
  const text = await res.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    // 非 JSON 响应（网关错误页之类）保留原文，下面按状态码报错
  }
  if (!res.ok) {
    // 平台的错误字段不统一：SDK 风格用 message/error，FastAPI 风格用 detail。
    // 全试一遍，免得把一个能一眼看懂的 401 打印成一段裸 JSON。
    const detail = parsed?.message ?? parsed?.error ?? parsed?.detail ?? text.slice(0, 200) ?? ''
    if (res.status === 401) {
      die(
        `个人 Key 被拒（HTTP 401：${detail}）。`,
        '多半是复制不全、已吊销，或者拿的是别的环境/别的账号的 Key。',
      )
    }
    die(`${method} ${path} → HTTP ${res.status}${detail ? `：${detail}` : ''}`)
  }
  return parsed
}

// ── 先看 .env，再动任何东西 ───────────────────────────────
// 顺序很重要：**这个检查必须在签发之前**。
// 实测踩过：原来放在最后（写文件前），结果是先向平台签出了一把新 Key，
// 再拒绝覆盖 .env —— 文件是保住了，但平台上多了一把**没有令牌留存**的孤儿 Key
// （token 只在签发那一刻返回，平台只存哈希），只能去控制台手动吊销。
// 一次误跑就留下一把废钥匙，所以宁可把检查提到最前面，什么都不做就退出。
let previous = null
try {
  previous = await readFile(ENV_PATH, 'utf8')
} catch {
  // 没有 .env 是最常见的情况
}
if (previous && /^OPENHEX_WORKSPACE_KEY=sk_\w+/m.test(previous) && !FORCE) {
  die(
    'apps/api/.env 里已经有一把工作区 Key 了，什么都没做。',
    [
      '确实要换一把的话加 --force（旧 Key 会就此丢失，需要的话先去控制台吊销）。',
      '只是想在同一个工作区上再签一把（例如给另一台机器）的话，',
      '去 app.openhex.tech 控制台签，或者先移开现有的 .env。',
    ].join('\n  '),
  )
}

// ── ① 找到（或创建）工作区 ────────────────────────────────
const list = await call('GET', '/api/v2/workspaces')
const workspaces = list?.workspaces ?? []
console.log(`① 你名下的工作区：${workspaces.length ? workspaces.map((w) => w.slug).join('、') : '（无）'}`)

let slug = WANT_SLUG ?? null

if (!slug && workspaces.length === 1) {
  slug = workspaces[0].slug
  console.log(`   只有一个，直接用：${slug}`)
} else if (!slug && workspaces.length === 0) {
  die(
    '你还没有工作区，需要先建一个。',
    'slug 为 3–64 位，只能含小写字母、数字和中划线，且不能以中划线开头或结尾。例如：\n\n' +
      '  OPENHEX_API_KEY=mysta_... pnpm --filter @lto/api bootstrap -- --slug=lanting-dining',
  )
} else if (!slug) {
  die(
    '有多个工作区，需要指定用哪一个。',
    `用 --slug= 选一个：${workspaces.map((w) => w.slug).join(' / ')}`,
  )
}

const existing = workspaces.find((w) => w.slug === slug)
if (existing) {
  console.log(`   用已有工作区：${slug}（${existing.display_name}，${existing.status}）`)
} else {
  if (workspaces.length > 0) {
    // 有别的 Key 权限但没有这个 slug —— 可能只是拼错了，先确认再建，避免建出一堆同义工作区
    console.log(`   "${slug}" 不在列表里，将新建。`)
  }
  if (DRY_RUN) {
    console.log(`   [dry-run] POST /api/v2/workspaces { slug: "${slug}" }`)
  } else {
    await call('POST', '/api/v2/workspaces', {
      slug,
      display_name: args.get('display-name') ?? slug,
    })
    console.log(`   已创建工作区：${slug}`)
  }
}

// ── ③ 签发工作区 Key ─────────────────────────────────────
if (DRY_RUN) {
  console.log(`③ [dry-run] POST /api/v2/workspaces/${slug}/api-keys { label: "${LABEL}" }`)
  console.log('\n（dry-run，没有发出写操作，也没有改 .env）\n')
  process.exit(0)
}

const created = await call('POST', `/api/v2/workspaces/${slug}/api-keys`, { label: LABEL })
const workspaceKey = created?.token
if (!workspaceKey || !workspaceKey.startsWith('sk_')) {
  die(`签发接口没有返回预期形状的 token（拿到：${JSON.stringify(created).slice(0, 200)}）`)
}
console.log(`② 已签发工作区 Key，label="${LABEL}"，id=${created.id ?? '?'}`)

// ── 落盘 ─────────────────────────────────────────────────
// 覆盖保护在文件顶部（动任何东西之前）已经做过了，这里只管写。
// 用 0600 写：里面是等同工作区权限的凭据，别给同机器上的其他用户读的机会。
await writeFile(
  ENV_PATH,
  [
    '# 由 scripts/bootstrap-workspace.mjs 生成，重新签发请再跑一次该脚本。',
    '# 已在 .gitignore 里（.env / .env.*），不要提交。',
    '',
    '# 工作区 API Key —— 后端密钥，只待在这个进程里，绝不能进浏览器或构建产物。',
    `OPENHEX_WORKSPACE_KEY=${workspaceKey}`,
    '',
    '# 工作区 slug',
    `OPENHEX_WORKSPACE_SLUG=${slug}`,
    '',
    '# 可选：网关监听端口，默认 8000，与 apps/web/vite.config.ts 的 /api 代理目标一致。',
    '# PORT=8000',
    '',
  ].join('\n'),
  { mode: 0o600 },
)

// 打印时打码：密钥已经落盘了，没必要再往终端和滚动回看里撒一份。
const masked = `${workspaceKey.slice(0, 11)}…${workspaceKey.slice(-4)}`
console.log(`③ 已写入 apps/api/.env（权限 600）`)
console.log(`   OPENHEX_WORKSPACE_KEY=${masked}`)
console.log(`   OPENHEX_WORKSPACE_SLUG=${slug}`)
console.log('\n下一步：pnpm dev，然后到 http://localhost:5173 聊一句。\n')
