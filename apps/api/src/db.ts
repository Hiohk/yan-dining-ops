/**
 * 画像存储：单文件 SQLite，用 Node 22 内置的 `node:sqlite`，零新增依赖。
 *
 * 为什么是 SQLite 而不是 Postgres / JSON 文件：
 *   - 网关这个进程刻意「少一层依赖」，引 Postgres 得再配一个服务 + 驱动；
 *   - 结构化事实（忌口走主键精确匹配、不向量召回）正是关系库的长处，
 *     一张表 + 一个复合索引就够了，JSON 文件做不了这种查询。
 *   - `node:sqlite` 是实验 API（启动会打 ExperimentalWarning），对学习项目可接受；
 *     将来想换 Postgres，只动这一个文件。
 *
 * 文件落在 apps/api/data/memory.db，已被 .gitignore 的 `*.db` 规则覆盖，
 * 上面又显式加了一条 `apps/api/data/` 目录规则，把可能的 -wal/-shm 一并挡住。
 */

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

/** 一条结构化事实。subject 为 'self'（本人）或联系人名，predicate 见下方白名单。 */
export interface MemoryFact {
  subject: string
  predicate: string
  value: string
  source: string
}

/** 写入画像时只关心这三个字段，source 由存储层统一写成 'profile'。 */
export type MemoryFactInput = Pick<MemoryFact, 'subject' | 'predicate' | 'value'>

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'data')

mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(join(dataDir, 'memory.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS memory_facts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    subject    TEXT NOT NULL DEFAULT 'self',
    predicate  TEXT NOT NULL,
    value      TEXT NOT NULL,
    source     TEXT NOT NULL DEFAULT 'profile',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_facts_visitor ON memory_facts(visitor_id, subject, predicate);

  -- 公司级常用对象（供应商/客户/同事），对所有访客相同，故不带 visitor_id。
  CREATE TABLE IF NOT EXISTS contacts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT '',
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- 对话历史镜像：id 直接用 OpenHex 的 conversationId。
  -- 时间戳存纪元毫秒整数（不是 datetime('now') 的秒精度）——
  -- 列表要按「最近更新」排，秒精度会让连续几轮同秒、顺序不稳。
  CREATE TABLE IF NOT EXISTS conversations (
    id            TEXT PRIMARY KEY,
    visitor_id    TEXT NOT NULL,
    title         TEXT NOT NULL DEFAULT '',
    message_count INTEGER NOT NULL DEFAULT 0,
    updated_at    INTEGER NOT NULL,
    created_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_conv_visitor ON conversations(visitor_id, updated_at DESC);

  -- 每条消息一行。seq 是会话内顺序（数组下标），消息没有稳定业务 id，
  -- 所以整段覆盖时靠 (conversation_id, seq) 唯一，幂等无重复。
  CREATE TABLE IF NOT EXISTS messages (
    conversation_id TEXT NOT NULL,
    seq            INTEGER NOT NULL,
    role           TEXT NOT NULL,
    text           TEXT NOT NULL,
    created_at     INTEGER NOT NULL,
    PRIMARY KEY (conversation_id, seq)
  );
`)

/** 取某访客的全部事实，按写入顺序返回（偏好里没有排序语义，稳定即可）。 */
export function getFacts(visitor: string): MemoryFact[] {
  const rows = db
    .prepare('SELECT subject, predicate, value, source FROM memory_facts WHERE visitor_id = ? ORDER BY id')
    .all(visitor)
  return rows.map((row) => ({
    subject: String(row.subject),
    predicate: String(row.predicate),
    value: String(row.value),
    source: String(row.source),
  }))
}

/**
 * 用给定事实**整体替换**某访客 `source='profile'` 的事实（先删后插，包在事务里）。
 * 只动 'profile' 这一种来源 —— 将来 Agent / CRM 写进来的事实不受编辑页覆盖。
 */
export function replaceFacts(visitor: string, facts: MemoryFactInput[]): number {
  const del = db.prepare('DELETE FROM memory_facts WHERE visitor_id = ? AND source = ?')
  const ins = db.prepare(
    'INSERT INTO memory_facts (visitor_id, subject, predicate, value, source) VALUES (?, ?, ?, ?, ?)',
  )

  db.exec('BEGIN')
  try {
    del.run(visitor, 'profile')
    for (const f of facts) ins.run(visitor, f.subject, f.predicate, f.value, 'profile')
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return facts.length
}

// ── 联系人 ─────────────────────────────────────────────

export interface Contact {
  name: string
  role: string
  notes: string
}

/** 预存的 12 个常用对象（模拟数据，测试用），逐字来自需求方提供的名单。 */
const SEED_CONTACTS: Contact[] = [
  { name: '罗永康', role: '供应商老板', notes: '无忌口，好热闹爱吃火锅，请他不用太正式的场合。' },
  { name: '何静', role: '销售部新人', notes: '不喝酒，聚餐时负责点无醇饮料帮大家挡酒。' },
  { name: '郑凯', role: '上海客户随行，XX集团技术负责人', notes: '花生过敏，一点都不能碰，点菜要避开花生和花生油。' },
  { name: '吴丽华', role: 'HR总监', notes: '不吃牛肉，口味偏粤菜清淡，团建喜欢有互动性的餐厅。' },
  { name: '周涛', role: '财务总监', notes: '控血糖，饮食要少油少糖，不喝酒，报销审核最严。' },
  { name: '孙倩', role: '董秘', notes: '不吃羊肉，下午的接待习惯安排咖啡而不是茶。' },
  { name: '赵启明', role: '北方客户，XX科技CTO', notes: '爱吃面食，白酒只喝酱香型，不吃甜口菜。' },
  { name: '张浩', role: '销售部同事', notes: '无忌口，能吃辣，爱吃日料，团建常选烤肉。' },
  { name: '李梅', role: '市场部总监', notes: '素食为主偶尔吃鱼，不吃生葱生蒜，点菜要单独配素菜。' },
  { name: '王志强', role: '华东区客户，XX集团采购总监', notes: '清真饮食，忌猪肉，不喝酒，安排餐厅需确保有清真资质。' },
  { name: '林晓芸', role: '销售VP', notes: '海鲜过敏，不吃辣，商务宴请只喝红酒。' },
  { name: '陈建国', role: '公司CEO', notes: '不吃内脏，偏爱淮扬菜，宴请重要客户习惯配酱香型白酒。' },
]

/** 表为空时才插入，幂等 —— 重启进程不会重复塞一遍。 */
function seedContacts(): void {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM contacts').get() as { count: number }
  if (count > 0) return
  const ins = db.prepare('INSERT INTO contacts (name, role, notes) VALUES (?, ?, ?)')
  db.exec('BEGIN')
  try {
    for (const c of SEED_CONTACTS) ins.run(c.name, c.role, c.notes)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function getContacts(): Contact[] {
  const rows = db.prepare('SELECT name, role, notes FROM contacts ORDER BY id').all()
  return rows.map((row) => ({
    name: String(row.name),
    role: String(row.role),
    notes: String(row.notes),
  }))
}

// ── 对话历史 ───────────────────────────────────────────

/** 前端镜像同步过来的一条消息。role 白名单在路由层校验。 */
export interface MessageInput {
  role: string
  text: string
  created_at?: number
}

export interface ConversationSummary {
  id: string
  title: string
  message_count: number
  updated_at: number
}

/**
 * 整段覆盖某段对话的镜像：conversations upsert + messages 删旧插新，包在事务里。
 * 删旧插新（而非增量）是因为消息没有稳定业务 id，增量去重不可靠；
 * 每轮结束时整段重写一次，幂等、且天然覆盖「上一轮被打断没写全」的残缺态。
 */
export function saveConversation(
  visitor: string,
  conv: { id: string; title: string; messages: MessageInput[] },
): void {
  const now = Date.now()
  const upsertConv = db.prepare(`
    INSERT INTO conversations (id, visitor_id, title, message_count, updated_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      message_count = excluded.message_count,
      updated_at = excluded.updated_at
  `)
  const delMsgs = db.prepare('DELETE FROM messages WHERE conversation_id = ?')
  const insMsg = db.prepare(
    'INSERT INTO messages (conversation_id, seq, role, text, created_at) VALUES (?, ?, ?, ?, ?)',
  )

  db.exec('BEGIN')
  try {
    upsertConv.run(conv.id, visitor, conv.title, conv.messages.length, now, now)
    delMsgs.run(conv.id)
    conv.messages.forEach((m, seq) => insMsg.run(conv.id, seq, m.role, m.text, m.created_at ?? now))
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/** 某访客的对话列表，最近更新在前。只回列表元数据，正文由前端切回时从 OpenHex 加载。 */
export function listConversations(visitor: string): ConversationSummary[] {
  const rows = db
    .prepare(
      'SELECT id, title, message_count, updated_at FROM conversations WHERE visitor_id = ? ORDER BY updated_at DESC',
    )
    .all(visitor)
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    message_count: Number(row.message_count),
    updated_at: Number(row.updated_at),
  }))
}

// 模块加载完成后再补种子 —— 必须放在 SEED_CONTACTS 与 seedContacts 定义之后，
// 否则顶层的调用会踩到 const 的暂时性死区（TDZ）。
seedContacts()
