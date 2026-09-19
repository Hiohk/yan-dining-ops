#!/usr/bin/env node
/**
 * 按 iPhone 视口（390×844 @2x）批量截图，用于与 UI-01 设计稿逐屏比对。
 *
 * 为什么不用 `chrome --headless --window-size=390,844 --screenshot`：
 * macOS 上 headless Chrome 的窗口有 500px 最小宽度下限，`--window-size` 小于 500
 * 会被静默抬到 500，且 `--force-device-scale-factor` 会让 `window.innerWidth`
 * 变成第三个值。而本项目的 `.lto-app` 是 `width:100%; max-width:480px`，
 * 视口 390 与 500 下的排版**并不相同**（page-x 走 vw、栅格列宽由容器宽推导），
 * 所以那样截出来的图不能用来判断还原度。唯一可靠的方式是 CDP 的设备模拟。
 *
 * 用法：
 *   node scripts/ui-shot.mjs                     # 全部路由，视口截图
 *   node scripts/ui-shot.mjs --full              # 整页截图（含滚动区域）
 *   node scripts/ui-shot.mjs --only home,chat    # 只截部分
 *   node scripts/ui-shot.mjs --base http://localhost:5173 --out /tmp/shots
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333

const ROUTES = [
  ['home', '/'],
  ['chat', '/chat'],
  ['tasks', '/tasks'],
  ['skills', '/skills'],
  ['me', '/me'],
  ['restaurants', '/restaurants'],
  ['invitation', '/invitation'],
]

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const BASE = flag('base', 'http://localhost:5173')
const OUT = flag('out', '/tmp/shots')
const FULL = argv.includes('--full')
const ONLY = flag('only', null)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 一个极简的 CDP 会话：只实现本脚本需要的方法，避免引入 puppeteer 依赖。 */
class Session {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      const p = this.pending.get(msg.id)
      if (p) {
        this.pending.delete(msg.id)
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
}

async function waitForDevtools(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return
    } catch {
      /* 还没起来 */
    }
    await sleep(150)
  }
  throw new Error('DevTools 端口未就绪')
}

async function shoot(name, path) {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
  const target = await res.json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })

  const s = new Session(ws)
  try {
    await s.send('Page.enable')
    // 关键：真正把视口设成 iPhone 的 390×844，而不是被 Chrome 抬到 500
    await s.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
      screenWidth: 390,
      screenHeight: 844,
    })
    await s.send('Page.navigate', { url: BASE + path })
    await sleep(1400) // 等 React 挂载 + 字体 + 图片解码
    const shot = await s.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: FULL,
    })
    await writeFile(join(OUT, `${name}.png`), Buffer.from(shot.data, 'base64'))

    // 顺带把关键盒模型打出来，避免靠肉眼判断「像不像」
    const probe = await s.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect()
          return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }
        const app = document.querySelector('.lto-app')
        const pad = (el) => el ? getComputedStyle(el).paddingLeft : null
        const grid = document.querySelector('section.grid')
        return {
          vw: innerWidth, vh: innerHeight,
          docW: document.documentElement.scrollWidth,
          overflowX: document.documentElement.scrollWidth > innerWidth,
          app: box(app),
          grid: box(grid),
          gridPad: pad(grid),
        }
      })()`,
    })
    console.log(`${name.padEnd(12)} ${path.padEnd(14)} ${JSON.stringify(probe.result.value)}`)
  } finally {
    ws.close()
    await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`)
  }
}

const profile = join(tmpdir(), `lto-shot-${Date.now()}`)
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--remote-allow-origins=*',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

try {
  await mkdir(OUT, { recursive: true })
  await waitForDevtools()
  const wanted = ONLY ? new Set(ONLY.split(',')) : null
  for (const [name, path] of ROUTES) {
    if (wanted && !wanted.has(name)) continue
    await shoot(name, path)
  }
} finally {
  chrome.kill()
  await rm(profile, { recursive: true, force: true }).catch(() => {})
}
