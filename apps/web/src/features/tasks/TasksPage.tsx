import { Calendar, ConciergeBell, MapPin, Users } from 'lucide-react'
import { useState } from 'react'
import { AppShell } from '../../app/AppShell'
import { PageHeader } from '../../app/NavBar'
import { Badge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { IconCircle } from '../../components/IconCircle'
import { SegmentedControl } from '../../components/SegmentedControl'
import { TASKS, TASK_TABS, type TaskItem, type TaskTab } from '../../lib/mock'

/**
 * UI-01 第 3 屏：餐务列表。
 *
 * 分档是 UI 投影，不是业务状态 —— 内部有 14 个精确状态（见方案 §7），
 * 这里只投影成「进行中 / 待处理 / 历史」三档。不要在页面里判断业务状态。
 *
 * 卡片解剖实测自 UI-01/03.png（本屏左右留白 15.0pt，卡片 x 15..375、高 161.3）。
 * 以下都是「相对卡片顶」的实测值，这样不受状态栏高度影响：
 *   底圆 +16.3..+55.3（即 39pt，卡片内边距 16.3 ⇒ p-4）
 *   标题文字 +26.2..+43.6 —— 中心 +34.9，与底圆中心 +35.8 重合，
 *     即标题是**垂直居中于底圆**的，不是与底圆顶对齐（按顶对齐会高 5.7pt）
 *   徽标 56.3 × 26.2、中心 +36.1，同样居中于底圆
 *   标题文字左缘 82.0、底圆右缘 70.5 ⇒ 圆与标题间距 11.5 ≈ gap-3
 *   信息行 +69.8 / +98.9 / +126.6 起，节距 28.4 —— 即从**底圆下缘** +55.3
 *     再留 12pt ⇒ mt-3。三条与设计的偏差 ≤1.3pt。
 *   信息行左缘与标题文字左缘对齐（82.0），**不是贴卡片左内边距**（那会是 16）。
 *     所以信息行必须放进标题右侧的内容列里靠 flex 自然缩进；
 *     写成 pl-[50px] 这种魔数，换字号或换图标尺寸就会错位。
 *   信息行图标 ≈17pt、图标→文字 ≈10.8、行间隙 ≈8.6 ⇒ gap-2.5 / gap-2
 * 图标为品牌绿 #62a966（取图标笔画像素的色簇心；细笔画被抗锯齿摊开，
 * 看众数计数会低到几十而误判），不是墨绿。
 */
export function TasksPage() {
  const [tab, setTab] = useState<TaskTab>('进行中')
  const items = TASKS[tab]

  return (
    <AppShell>
      <PageHeader title="餐务" />

      <div className="px-page-tab pb-4">
        <SegmentedControl options={TASK_TABS} value={tab} onChange={setTab} />
      </div>

      {/* 卡间距实测 13.1pt，不能用 --lto-gap-y（那是首页瓦片栅格的 12，
          而首页瓦片的行间距其实是 9.4）—— 一个值套三处就会处处不对。 */}
      <div className="flex flex-col gap-y-3.25 px-page-tab">
        {items.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {items.length === 0 ? <EmptyState tab={tab} /> : null}
      </div>
    </AppShell>
  )
}

/** 标题底圆直径，实测 39pt。标题行要与它等高居中、信息行要从它下缘起算，
 *  所以抽成常量三处共用 —— 写死两次迟早会漂。 */
const TITLE_DOT = 39

function TaskCard({ task }: { task: TaskItem }) {
  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <IconCircle icon={ConciergeBell} size={TITLE_DOT} />

        {/* 内容列：标题与信息行共用同一条左基线，信息行因此自动缩进到标题下方 */}
        <div className="min-w-0 flex-1">
          {/* 标题行强制与底圆等高：设计稿里标题（行高 26.2）是**垂直居中于底圆**
             的，不是与底圆顶对齐。按顶对齐排，标题会比设计稿高 5.7pt。 */}
          <div className="flex items-center gap-3" style={{ height: TITLE_DOT }}>
            <h2 className="truncate text-17 font-semibold text-ink">{task.title}</h2>
            <Badge tone={task.badgeTone} className="ml-auto">
              {task.badgeText}
            </Badge>
          </div>

          {/* mt-3 是从底圆下缘（＝标题行下缘，因为两者等高）算起的 12pt */}
          <dl className="mt-3 flex flex-col gap-2">
            <InfoRow icon={Calendar} text={task.date} />
            <InfoRow icon={Users} text={task.people} />
            <InfoRow icon={MapPin} text={task.place} />
          </dl>
        </div>
      </div>
    </Card>
  )
}

function InfoRow({ icon: Icon, text }: { icon: typeof Calendar; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="size-4.25 shrink-0 text-primary" strokeWidth={1.7} />
      <dd className="truncate text-14 text-ink-1">{text}</dd>
    </div>
  )
}

function EmptyState({ tab }: { tab: TaskTab }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-2 text-center">
      <p className="text-15 text-ink-2">「{tab}」暂无餐务</p>
      <p className="text-13 text-ink-3">在 AI 助理里说一句话，餐务会自动建起来</p>
    </div>
  )
}
