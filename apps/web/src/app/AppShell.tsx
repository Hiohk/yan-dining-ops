import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { TabBar } from './TabBar'

/**
 * 带 Tab 栏的一级页面外壳（首页 / 餐务 / 技能 / 我的）。
 * 二级页（对话、找餐厅、邀请函）不用它 —— 那些页面是整屏且无 Tab 栏的，
 * 这是 UI-01 的结构事实：第 2 屏对话页没有底部 Tab。
 */
export function AppShell({
  children,
  className,
  withInputBar = false,
}: {
  children: ReactNode
  className?: string
  /** 首页底部有输入条，滚动区要预留它的高度 */
  withInputBar?: boolean
}) {
  // 滚动区底部要同时让开 Tab 栏，以及首页那根浮在 Tab 栏之上的输入条
  const bottom = withInputBar
    ? 'calc(var(--lto-tabbar-h) + var(--lto-safe-bottom) + var(--lto-inputbar-gap) + var(--lto-inputbar-h) + 8px)'
    : 'calc(var(--lto-tabbar-h) + var(--lto-safe-bottom) + 8px)'

  return (
    <div className="lto-app flex flex-col">
      <main
        className={cn('no-scrollbar flex-1 overflow-y-auto pt-safe', className)}
        style={{ paddingBottom: bottom }}
      >
        {children}
      </main>
      <TabBar />
    </div>
  )
}

/** 二级整屏页外壳：无 Tab 栏，底部可挂输入条或主按钮 */
export function ScreenShell({
  children,
  footer,
  className,
  scroll = true,
  footerClassName,
}: {
  children: ReactNode
  footer?: ReactNode
  className?: string
  scroll?: boolean
  /** 底部条的左右留白。默认跟对话页一致；邀请函页要传 px-page-wide */
  footerClassName?: string
}) {
  return (
    <div className="lto-app flex flex-col">
      <div
        className={cn(
          'flex-1 pt-safe',
          scroll ? 'no-scrollbar overflow-y-auto' : 'overflow-hidden',
          className,
        )}
      >
        {children}
      </div>
      {footer ? (
        <div
          className={cn(
            'sticky bottom-0 z-10 bg-bg/95 pb-safe backdrop-blur-sm',
            footerClassName ?? 'px-page',
          )}
        >
          <div className="pt-2 pb-3">{footer}</div>
        </div>
      ) : null}
    </div>
  )
}
