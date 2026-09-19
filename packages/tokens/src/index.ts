/**
 * 设计 token 的 TS 镜像（与 tokens.css 一一对应）。
 *
 * 只有在 CSS 变量无法表达的地方才用这里（Canvas、图表配色、内联计算）。
 * 组件里一律用 Tailwind 类名（bg-primary / text-ink / rounded-card），不要引这里的常量，
 * 否则 token 就有了两个真相源。
 */

export const color = {
  primary: '#62a966',
  primaryPress: '#55975a',
  primaryDeep: '#4a8b50',
  primarySoft: '#eef8ee',
  primaryTint: '#f1f8f1',
  brandInk: '#17352a',

  bg: '#f4faf6',
  surface: '#ffffff',
  surfaceSunken: '#f2f6f3',

  text: '#17352a',
  textMuted: '#5c6b63',
  textFaint: '#a5abb0',

  border: '#e6efe8',
  borderStrong: '#d3e2d7',

  warningBg: '#fff2df',
  warningFg: '#b7791f',
  infoBg: '#e8f2fd',
  infoFg: '#0983c9',
  successBg: '#e9f6ea',
  successFg: '#3f7a45',
  dangerBg: '#fdeceb',
  dangerFg: '#c9453f',
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  card: 18,
  xl: 22,
  pill: 999,
} as const

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  title: 24,
} as const

/** 设计稿几何实测值（已换算到 390pt 视口） */
export const metrics = {
  appMaxWidth: 480,
  tabbarHeight: 48,
  inputbarHeight: 56,
  sendButtonSize: 44,
  quickTileHeight: 64,
  iconCircleSize: 38,
} as const

/** UI-01 语义徽标：餐务列表用这三档 */
export const badgeTone = {
  pending: 'warn',
  reimbursing: 'info',
  done: 'success',
} as const
