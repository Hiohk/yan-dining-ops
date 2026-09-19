/**
 * 卡片协议 —— 前端可渲染的最小事实来源。
 *
 * 正式管线：后端 `protocol/cards.py`（Pydantic v2）→ model_json_schema() 供 LLM function calling
 *          → 构建期生成 `./generated.ts`，CI 校验 git diff 为空。
 * 本文件是**手写的运行时契约**（判别联合 + 渲染所需字段），与生成物保持同构。
 * 之所以手写一层：UI 骨架阶段还没有后端，但渲染管线必须先跑通，否则卡片协议无处验证。
 *
 * 四条协议纪律（对应方案 §8）：
 *  1. 每个卡片带 `v` 协议版本；前端对未知版本做**降级渲染**并保留 actions，绝不白屏
 *  2. 快捷回复统一为 `action.kind: "prompt"`，不再有独立的 chips 字段 —— 否则 chip 没有幂等键
 *  3. `idempotencyKey` 由服务端生成，且必须是**业务键**（idem:{taskId}:time:{optionId}），
 *     不能用随机 UUID：否则「刷新后重试」会生成新键，导致重复发邀请
 *  4. `disabled` + `disabledReason` 显式下发，前端不得自行推断按钮可不可点
 */

export const CARD_PROTOCOL_VERSION = 1

/** ── 通用构件 ───────────────────────────────────────────── */

export interface CardAction {
  id: string
  label: string
  /**
   * prompt    —— 点了就把 label 当作用户输入发出去（快捷回复 chip）
   * navigate  —— 前端路由跳转
   * confirm   —— 触发副作用闸门（服务端校验 pendingStep 后执行）
   */
  kind: 'prompt' | 'navigate' | 'confirm'
  /** kind=navigate 时的目标路由 */
  to?: string
  /** kind=confirm 时的服务端幂等键，必须由服务端生成 */
  idempotencyKey?: string
  disabled?: boolean
  disabledReason?: string
  /** 主按钮样式（一行最多一个） */
  primary?: boolean
}

export interface CardBadge {
  text: string
  tone: 'neutral' | 'warn' | 'info' | 'success' | 'danger'
}

export interface CardBase {
  /** 协议版本，前端据此决定能否原生渲染 */
  v: number
  id: string
  kind: string
  /** 归属任务；除 TASKLESS_CARDS 白名单外必须非空（约束 C6） */
  taskId?: string
  title?: string
  badge?: CardBadge
  actions?: CardAction[]
}

/** ── 九类卡片 ───────────────────────────────────────────── */

/** 1. 时间协调：候选时段单选 */
export interface TimeOptionsCard extends CardBase {
  kind: 'time_options'
  options: Array<{
    id: string
    label: string
    hint?: string
    selected?: boolean
    unavailable?: boolean
  }>
}

/** 2. 餐厅推荐：UI-01 找餐厅页的同构数据 */
export interface RestaurantOptionsCard extends CardBase {
  kind: 'restaurant_options'
  query: {
    date?: string
    people?: number
    perCapita?: number
    privateRoom?: boolean
  }
  items: Array<{
    id: string
    name: string
    tags: string[]
    description?: string
    distanceKm?: number
    perCapita: number
    rating?: number
    recommended?: boolean
    imageUrl?: string
  }>
}

/** 3. 用餐方案确认：包间锁定前的一次性闸门 */
export interface DiningPlanCard extends CardBase {
  kind: 'dining_plan'
  plan: {
    date: string
    timeRange: string
    restaurant: string
    room: string
    people: number
    perCapita: number
    total: number
  }
  /** 确认后会自动执行的后续动作，用于「确认即自动执行」文案 */
  autoNext: string[]
}

/** 4. 邀请函：生成 + 渠道选择 */
export interface InvitationCard extends CardBase {
  kind: 'invitation'
  event: {
    title: string
    date: string
    time: string
    restaurant: string
    address: string
  }
  channels: Array<{ id: string; label: string; enabled: boolean }>
}

/**
 * 5. 用餐计划：**流程的终态卡**，一张卡同时是「计划」和「邀请函」。
 *
 * 为什么不让 `invitation` 收尾、也不把两者并成一张：上一版流程在 `dining_plan`
 * 确认之后还要再选一次发送渠道（飞书/微信），但「邀请」和「计划」本来就是同一件事
 * 的两面 —— 分两步意味着用户要为一个已经定完的行程再点一次。所以终态只留一张卡：
 * 计划的内容（时间/地点/人数/金额）本身就是邀请的内容。
 *
 * 与 `invitation` 的差别，两条都是刻意的：
 *   - **没有 `channels`**。渠道选择是「发送」的实现细节，而这里只有一个动作：
 *     分享（`navigator.share`），由前端内置，不走 `actions`、也不回给模型。
 *   - **金额进卡**（`perCapita` / `total`）。发票/报销那条尾巴切掉之后，
 *     这是全场唯一一次把花费摆出来的地方。
 *
 * `invitation` 卡种**保留未删**：以后若要把「邀请函选渠道」恢复成独立一步，
 * 视图和协议都还在（见 `InvitationCardView`）。
 */
export interface PlanSummaryCard extends CardBase {
  kind: 'plan_summary'
  plan: {
    /** 宴请/会议名，卡头大字，如「与百事可乐商务晚宴」 */
    title: string
    date: string
    /** 「18:00」或「18:00-21:00」，两种写法都接受：定完钟点才知道要不要写时段 */
    time: string
    restaurant: string
    address: string
    /** 包间名。**不确定就不要写**，不要填「待定」—— 那会被当成已落实 */
    room?: string
    people: number
    perCapita: number
    total: number
  }
}

/** 6. 点菜助手：菜品 + 忌口命中 */
export interface MenuCard extends CardBase {
  kind: 'menu'
  /** 已生效的饮食约束（来自 memory_facts 精确 JOIN，非模型推断） */
  constraints: Array<{ contactName: string; type: string; detail: string }>
  dishes: Array<{
    id: string
    name: string
    tags: string[]
    price: number
    /** 命中的过敏原/忌口，非空时前端必须显著提示 */
    allergenHits: string[]
  }>
  summary: { people: number; perCapita: number; subtotal: number; budget: number }
}

/** 7. 发票识别 */
export interface InvoiceCard extends CardBase {
  kind: 'invoice'
  invoice: {
    kind: string
    number: string
    buyer: string
    seller: string
    amount: number
    taxId: string
    issuedAt: string
    /** OCR 置信度低于阈值时前端加「请核对」提示 */
    confidence: number
  }
  quota: { used: number; total: number; period: string }
}

/** 8. 报销与审批 */
export interface ReimbursementCard extends CardBase {
  kind: 'reimbursement'
  claim: { no: string; status: string; total: number }
  lines: Array<{ label: string; amount: number }>
  steps: Array<{
    id: string
    label: string
    status: 'done' | 'current' | 'todo'
    at?: string
    note?: string
  }>
}

/** 9. AI 进度：唯一的进度真相，由 MAIN_PATH 派生（约束 C3） */
export interface ProgressCard extends CardBase {
  kind: 'progress'
  done: number
  total: number
  steps: Array<{ label: string; status: 'done' | 'current' | 'todo' }>
  note?: string
}

export type AnyCard =
  | TimeOptionsCard
  | RestaurantOptionsCard
  | DiningPlanCard
  | InvitationCard
  | PlanSummaryCard
  | MenuCard
  | InvoiceCard
  | ReimbursementCard
  | ProgressCard

/** 无任务归属的白名单卡片（约束 C6 的例外，必须显式列举） */
export const TASKLESS_CARDS: ReadonlySet<string> = new Set([
  'restaurant_options',
  'progress',
])

export function isKnownCard(card: CardBase): card is AnyCard {
  return card.v <= CARD_PROTOCOL_VERSION && CARD_KINDS.has(card.kind)
}

export const CARD_KINDS: ReadonlySet<string> = new Set([
  'time_options',
  'restaurant_options',
  'dining_plan',
  'invitation',
  'plan_summary',
  'menu',
  'invoice',
  'reimbursement',
  'progress',
])
