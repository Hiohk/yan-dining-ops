#!/usr/bin/env node
/**
 * 用**训练模式**把卡片协议写进 Agent（默认小宴知）。
 *
 * 为什么是训练模式而不是改环境变量：Agent 的人设 / 技能存在平台上，
 * 控制台里手点固然可以，但那样「写了什么」就只活在某次人工操作里，
 * 改完没法复现、没法比对、也没法在换 Agent 时重放。走接口至少留下了这个文件。
 *
 * ⚠️ 两件事必须知道：
 *   ① **训练会真实修改 Agent 的能力**（技能 / 知识 / 人设）。文档的原话是
 *      「对已经发布、正在服务用户的 Agent，请像在网页端训练一样谨慎」。
 *      所以默认先 `--dry-run` 看一眼要发什么。
 *   ② 训练接口只认**所有者的个人 API Key**（mysta_…）。用工作区 Key 或
 *      会话令牌都会得到 404 Agent not found —— 对非所有者，训练入口不存在。
 *
 * 提示词**从 `卡片协议与提示词.md` 的 §2 里抽**，不在这里另抄一份：
 * 人审的是那份文档，发出去的就必须是同一段文字，否则两边会悄悄分叉。
 *
 * 用法：
 *   OPENHEX_API_KEY=mysta_... pnpm --filter @lto/api apply-prompt -- --dry-run
 *   OPENHEX_API_KEY=mysta_... pnpm --filter @lto/api apply-prompt
 *   OPENHEX_API_KEY=mysta_... pnpm --filter @lto/api apply-prompt -- --agent=<id> --doc=<path>
 */

import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { OpenhexClient, extractText, isTurnComplete } from '@openhex-ai/agent-sdk'

const DEFAULT_AGENT = 'ef8da01c-7f70-4b49-8818-019ff2e83ccf' // 小宴知
const DEFAULT_DOC = new URL('../../../卡片协议与提示词.md', import.meta.url)

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [k, ...rest] = raw.replace(/^--/, '').split('=')
    return [k, rest.join('=') || 'true']
  }),
)
const DRY_RUN = args.has('dry-run')
const AGENT_ID = args.get('agent') ?? DEFAULT_AGENT
const DOC_PATH = args.get('doc') ?? DEFAULT_DOC

function die(message, hint) {
  console.error(`\n✗ ${message}`)
  if (hint) console.error(`\n  ${hint}`)
  console.error()
  process.exit(1)
}

// ── 凭据校验（在网络请求之前）─────────────────────────────
// 先尝试从 apps/api/.env 读。**不写这句的话，Key 放进 .env 也读不到** ——
// `node scripts/apply-agent-prompt.mjs` 不会自己加载 .env，
// 现象是「明明写进去了还说缺少 OPENHEX_API_KEY」，而 die() 的提示当时还在说
// 「别写进文件」，正好把人往反方向指。写法与 src/index.ts 一致（Node 20.12+ 内置解析）。
// 环境变量优先：loadEnvFile 不覆盖已有的 process.env，所以临时覆盖仍然照旧写法工作。
try {
  process.loadEnvFile(new URL('../.env', import.meta.url))
} catch {
  // 没有 .env 属正常情况 —— 下面统一校验
}

// 和 bootstrap-workspace.mjs 同一个理由：两种 Key 混淆后的报错（404 Agent not found）
// 完全看不出问题出在 Key 的类型上，这里看一眼前缀就能定死。
const apiKey = process.env.OPENHEX_API_KEY?.trim()
if (!apiKey) {
  die(
    '缺少 OPENHEX_API_KEY。',
    [
      '这一步要的是**所有者个人** API Key（mysta_…），不是工作区 Key。',
      '两种给法都行：',
      '',
      '  ① 写进 apps/api/.env（已 gitignore，与工作区 Key 同一个文件）：',
      '       OPENHEX_API_KEY=mysta_...',
      '  ② 只给这一次（不落盘，进程结束即没）：',
      '       OPENHEX_API_KEY=mysta_... pnpm --filter @lto/api apply-prompt -- --dry-run',
      '',
      '  走 ① 的话，写完 Key 记得清一次终端记录 —— 临时写进命令行的 Key',
      '  会留在 shell history 里，而个人 Key 等同账号全部权限。',
    ].join('\n  '),
  )
}
if (apiKey.startsWith('sk_')) {
  die(
    'OPENHEX_API_KEY 填的是工作区 Key（sk_…）。',
    '训练接口只认所有者个人 Key —— 用工作区 Key 会返回 404 Agent not found，看不出是 Key 的问题。',
  )
}
if (!apiKey.startsWith('mysta_')) {
  die(
    `OPENHEX_API_KEY 不像个人 API Key（应以 mysta_ 开头，实际是 "${apiKey.slice(0, 8)}…"）。`,
    '个人 Key 在 app.openhex.tech 的 设置 → API Key 创建。',
  )
}

// ── 抽提示词 ─────────────────────────────────────────────
const doc = await readFile(DOC_PATH, 'utf8').catch(() => null)
if (doc === null) die(`读不到提示词文档：${DOC_PATH}`)

const section = doc.split('## 2. 提示词全文')[1]
if (!section) die('文档里找不到「## 2. 提示词全文」这一节。')

// 提示词本身含 ``` 代码块，所以外层用四个反引号 —— 这里必须跟着用四个才切得准
const match = section.match(/^````\n([\s\S]*?)\n````$/m)
if (!match) die('找不到 §2 里四反引号包起来的提示词正文。')

const prompt = match[1].trim()

/**
 * 训练对话**每个 Agent 只有一条**（Agent id 就是对话标识），所以它会被历史话题占住。
 * 实测：第一次写入时，这条训练线程里还挂着一场关于连接器 403 的旧对话，
 * Agent 直接接着旧话题回答，2910 字的卡片协议被整个忽略。
 * 所以写入前先声明「这是新指令、旧话题作废」—— 否则规则落不下去，
 * 而失败现象是「Agent 回了很长一段话」，看起来像成功。
 */
const RESET =
  args.get('reset') ??
  [
    '下面是一条新的长期规则，与之前讨论的连接器 / 部署话题无关，那个话题到此为止。',
    '如果我已经有一套叫 lto-cards 的卡片规则，请**用下面这一版整体替换掉它**，',
    '不要新旧两版并存 —— 两套并存的规则会在细节上互相打架。',
  ].join('')

const payload = `${RESET}\n\n${prompt}`
const digest = createHash('sha256').update(payload).digest('hex').slice(0, 16)

console.log(`提示词：${prompt.length} 字（+ 前置切断 ${RESET.length} 字），合计 ${payload.length} 字，sha256=${digest}`)
console.log(`目标 Agent：${AGENT_ID}`)
console.log('── 开头 ──')
console.log(
  prompt
    .split('\n')
    .slice(0, 3)
    .join('\n'),
)
console.log('── 结尾 ──')
console.log(
  prompt
    .split('\n')
    .slice(-2)
    .join('\n'),
)

if (DRY_RUN) {
  console.log('\n（dry-run：没有发给 Agent，能力未被修改）\n')
  process.exit(0)
}

// ── 写入 ─────────────────────────────────────────────────
const client = new OpenhexClient({ apiKey, agentId: AGENT_ID })
const training = client.training()

console.log('\n正在写入（训练轮），Agent 可能会回一大段……\n')
let reply = ''
for await (const record of training.runTurn(payload)) {
  if (record.sender === 'assistant' || record.sender === 'agent') {
    const text = extractText(record)
    if (text) {
      reply += text
      process.stdout.write(text)
    }
  }
  if (isTurnComplete(record)) break
}

console.log(`\n\n── 训练轮结束（Agent 回了 ${reply.length} 字）──`)
console.log('下一步：到 http://localhost:5173/chat 说一句话，看它出的是卡片还是长文本。\n')
