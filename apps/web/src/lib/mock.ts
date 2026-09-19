/**
 * 展示数据，文案与 UI-01 六屏逐字对齐。
 *
 * **对话那一块已经不在这里了**：接 OpenHex 之后，消息与领域卡片由 Agent 产出
 * （卡片走工具调用，见 features/assistant/ToolCallCard.tsx），
 * 原先的 `ChatMessage` / `DEMO_MESSAGES` 已删除 —— 留一段平台不知情的假消息，
 * 只会让用户接着追问时对不上。
 *
 * 剩下的餐务 / 技能 / 我的几屏仍是静态数据；接后端时改由 TanStack Query 拉取，
 * 页面组件只依赖下方这些**领域类型**，不依赖数据来源，因此替换时页面无需改动。
 */

export type TaskStatusTone = 'warn' | 'info' | 'success' | 'neutral'

export interface TaskItem {
  id: string
  title: string
  badgeText: string
  badgeTone: TaskStatusTone
  date: string
  people: string
  place: string
}

export type TaskTab = '进行中' | '待处理' | '历史'

export const TASK_TABS: TaskTab[] = ['进行中', '待处理', '历史']

export const TASKS: Record<TaskTab, TaskItem[]> = {
  进行中: [
    {
      id: 't-2026-0918-01',
      title: '上海客户商务晚宴',
      badgeText: '待确认',
      badgeTone: 'warn',
      date: '9月18日 18:30',
      people: '5人',
      place: '四季民福',
    },
    {
      id: 't-2026-0901-02',
      title: '团队月度聚餐',
      badgeText: '报销中',
      badgeTone: 'info',
      date: '9月1日 19:30',
      people: '25人',
      place: 'xxxx',
    },
  ],
  待处理: [],
  历史: [],
}

/**
 * 首页四个快捷入口（UI-01 首页 2×2 卡片，文案与图标一一对应）。
 *
 * 第二格原来是「处理发票」。改成「安排商务宴请」的原因是**入口不该通向已经被关掉的路**：
 * 对话侧的提示词已明确不进入开发票 / 报销 / 审批（见 `卡片协议与提示词.md` §一），
 * 这个 chip 若还叫「处理发票」，点下去只会得到一句「暂不支持」—— 一个注定碰壁的入口。
 *
 * 换成宴请而不是直接删掉，是为了**保住 2×2 栅格**：只剩三个入口时第二行只有一格，
 * 首页快捷区的节奏会变（四个格子是设计稿的排版事实，不是随手凑的数）。
 * 新的这一格正好落在现有主流程上（时间 → 餐厅 → 方案 → 用餐计划）。
 *
 * ⚠️ 发票这条线在**别处仍然保留**（技能页的发票识别 / 开票信息、餐务页的报销状态）——
 * 那些不是对话流程，接真后端时还要用。所以这里的改动范围就是这两处常量的第二格。
 */
export type QuickEntryKey = 'restaurant' | 'banquet' | 'team' | 'other'

export const QUICK_ENTRIES: Array<{ key: QuickEntryKey; label: string; prompt: string }> = [
  { key: 'restaurant', label: '预定餐厅', prompt: '帮我预定一家餐厅' },
  { key: 'banquet', label: '安排商务宴请', prompt: '帮我安排一次商务宴请' },
  { key: 'team', label: '安排团队餐', prompt: '帮我安排一次团队餐' },
  { key: 'other', label: '其他需求', prompt: '我还有其他需求' },
]

export interface Restaurant {
  id: string
  name: string
  image: string
  tags: string[]
  description: string
  /** 未知时**不显示**，不要补 0 —— 「0km」在用户眼里等于「就在楼下」，是捏造事实 */
  distanceKm?: number
  /** 同上：未知时就别显示价格。实测踩过渲染出一个只有「¥」的空价格 */
  perCapita?: number
  recommended?: boolean
}

/** UI-01 找餐厅页三家餐厅，文案逐字还原 */
export const RESTAURANTS: Restaurant[] = [
  {
    id: 'r-sjmf',
    name: '四季民福（王府井店）',
    image: '',
    tags: ['北京特色', '包间'],
    description: '传承京味，甄选时令食材，让相聚更有味道。',
    distanceKm: 1.2,
    perCapita: 268,
    recommended: true,
  },
  {
    id: 'r-xhyy',
    name: '羲和雅苑',
    image: '',
    tags: ['商务宴请', '景观'],
    description: '临水而坐，景致与美味相映。',
    distanceKm: 3.6,
    perCapita: 320,
  },
  {
    id: 'r-jingji',
    name: '京季',
    image: '',
    tags: ['高端', '创意京菜'],
    description: '以现代手法诠释京味。',
    distanceKm: 5.8,
    perCapita: 380,
  },
]

export const RESTAURANT_FILTERS = ['日期', '人数', '预算', '包间'] as const

/** 技能中心（UI-01 技能页四组，文案逐字还原） */
export interface SkillGroup {
  key: string
  title: string
  hint?: string
  columns: 2 | 3
  items: Array<{ key: string; label: string }>
}

export const SKILL_GROUPS: SkillGroup[] = [
  {
    key: 'before',
    title: '餐前',
    hint: '做好准备，轻松赴约',
    columns: 2,
    items: [
      { key: 'find-restaurant', label: '找餐厅' },
      { key: 'check-availability', label: '查空闲时间' },
      { key: 'create-schedule', label: '创建日程' },
      { key: 'make-invitation', label: '生成邀请函' },
    ],
  },
  {
    key: 'during',
    title: '餐中',
    hint: '用餐过程，更省心',
    columns: 3,
    items: [
      { key: 'order-helper', label: '点菜助手' },
      { key: 'allergen-alert', label: '忌口提醒' },
      { key: 'budget-calc', label: '预算计算' },
    ],
  },
  {
    key: 'after',
    title: '餐后',
    hint: '收尾工作，高效处理',
    columns: 3,
    items: [
      { key: 'invoice-ocr', label: '发票识别' },
      { key: 'submit-claim', label: '发起报销' },
      { key: 'claim-status', label: '报销状态' },
    ],
  },
  {
    key: 'enterprise',
    title: '企业服务',
    columns: 2,
    items: [
      { key: 'meal-standard', label: '查餐标' },
      { key: 'policy', label: '查制度' },
      { key: 'invoice-info', label: '开票信息' },
      { key: 'contact', label: '企业联系人' },
    ],
  },
]

export const INPUT_PLACEHOLDER = '有什么可以帮你？'

// 换行位置刻意与 UI-01 首页逐行对齐：设计稿断在顿号后，
// 交给浏览器自动折行会断在「团/队」中间，所以这里写死换行符。
//
// ⚠️ 这里的「处理发票」于 2026-09-19 明确**决定保留**，不是漏改。
// 对话侧的提示词已经不进入开发票 / 报销 / 审批（见 `卡片协议与提示词.md` §一），
// 所以这句问候确实**承诺了一个对话会拒绝的能力**。当时权衡过三版改法，
// 拍板是「设计稿逐字保真优先」—— 与下面 QUICK_ENTRIES 改第二格不矛盾：
// 那个 chip 是**可点的入口**，点下去必然碰壁，属于功能缺陷；
// 问候语只是自我介绍，不会把用户直接送进死路。
// 下次看到这里觉得别扭时，先确认产品侧是不是已经改口，别顺手改掉。
export const HOME_GREETING =
  'Hi！我是小燕同学\n可以帮你安排商务宴请、\n团队用餐、处理发票等。\n今天有什么需要吗？'

export const INVITATION_DEMO = {
  title: '上海客户商务晚宴',
  date: '9月18日',
  time: '18:30',
  restaurant: '四季民福·故宫店',
  address: '北京市东城区景山前街4号',
  line1: '以美食为媒',
  line2: '共话合作新篇章',
}

export const INVITATION_STYLES = [
  { key: 'formal', label: '正式' },
  { key: 'business', label: '商务' },
  { key: 'simple', label: '简约' },
] as const

export const INVITATION_CHANNELS = [
  { key: 'email', label: '邮件发送' },
  { key: 'wecom', label: '企业微信' },
] as const

/**
 * 「我的」。UI-01 六屏里没有这一屏，内容逐条取自 **UI-02/12_我的.png**，
 * 视觉语言仍走 UI-01 的 token。
 *
 * 文案已按设计稿 + 需求文档 V0.4 的产品结构（`需求文档资料/…_V0.4.md:228-252`）逐字校正过，
 * 三处曾与稿子不一致：`忌口/过敏`→`口味/忌口`、`常用商圈`→`常用区域`、`历史餐务`→`历史用餐`。
 * 企业信息的成本中心是 **PD-02**（产品部），不是 PO-02 —— 设计稿里是硬数值，不是占位符。
 *
 * 这一屏直接对应后端的 `users` / `memory_facts` / `contacts` / `orgs` 四张表：
 * 偏好四项是 (subject=self, predicate=dietary_x / cuisine / area / restaurant) 的结构化事实，
 * 常用对象是 contacts。**忌口走主键精确匹配，永不做相似度召回**（见技术方案 V2.0 决策三）。
 */
export interface ProfileRow {
  label: string
  value: string
}

export const PROFILE_NAME = '李经理'
export const PROFILE_ROLE = '产品部 · 商务负责人'
export const PROFILE_BADGE = '企业已认证'

export const PREFERENCES: ProfileRow[] = [
  { label: '菜系偏好', value: '京菜 · 粤菜 · 本帮菜' },
  { label: '口味 / 忌口', value: '不吃香菜 · 忌辛辣' },
  { label: '常用区域', value: '国贸 · 三里屯 · 金融街' },
  { label: '常用餐厅', value: '四季民福 · 花家怡园' },
]

/* 设计稿里这两组是**纯胶囊入口**（无二级说明、无数值），不是可展开的明细列表 ——
   所以这里只给标签。等 Phase 1 接上真实数据后，数值走各自的列表页，不挤在胶囊里。 */
export const CONTACTS = ['张总（领导）', '上海客户', '产品部同事']

export const HISTORY_ENTRIES = ['历史用餐', '消费记录', '报销记录']

export const ORG_NAME = '北京某某科技有限公司（产品部）'
export const ORG_TAX = '税号 91110108MA01XXXXXX · 成本中心 PD-02'
