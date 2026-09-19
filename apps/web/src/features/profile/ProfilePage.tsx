import { useEffect, useState } from 'react'
import { AppShell } from '../../app/AppShell'
import { PageHeader } from '../../app/NavBar'
import { Badge } from '../../components/Badge'
import { Card } from '../../components/Card'
import { CONTACTS, HISTORY_ENTRIES, ORG_NAME, ORG_TAX, PREFERENCES, PROFILE_BADGE, PROFILE_NAME, PROFILE_ROLE } from '../../lib/mock'
import {
  LABEL_TO_PREDICATE,
  PREDICATE_LABELS,
  fetchMemory,
  saveFacts,
  type MemoryFact,
} from '../assistant/memory'

/**
 * 「我的」。UI-01 六屏里没有这一屏，内容逐条取自 UI-02 第 12 屏，视觉语言统一到 UI-01。
 *
 * 版式按 UI-02/12_我的.png 校正过三处与原先实现不符的地方：
 *   ① 全屏只有 **3 张卡**。「常用对象 / 历史记录 / 企业信息」是同一张卡里的三个小节，
 *      原先实现拆成了三张独立卡 —— 层级被抬高了。
 *   ② 「常用对象」「历史记录」是**纯胶囊组**（无二级说明、无箭头、无数值），
 *      原先实现渲染成了 label→value 两栏明细列表，等于给入口加了不存在的信息量。
 *   ③ 「我的偏好」是 label→value 两栏，但**没有右侧箭头**；原先每行都挂了
 *      ChevronRight，暗示可跳转，而设计稿全屏没有任何箭头。
 *
 * 「我的偏好」现在**读真实画像**（后端 memory_facts 表），没写过时回退到 mock。
 * 编辑只覆盖本人四项偏好 (subject=self, predicate=cuisine/dietary/area/restaurant)，
 * 常用对象 / 历史 / 企业信息本期仍走 mock —— 联系人事实的编辑留到后续 phase。
 */

/** 本人偏好的四项，顺序即展示顺序（与后端 buildInjection 的固定顺序一致）。 */
const SELF_PREDICATES = ['cuisine', 'dietary', 'area', 'restaurant'] as const

interface Pref {
  predicate: string
  label: string
  value: string
}

/** 从事实里取四项偏好；没有后端数据时回退 mock，让页面不至于空着。 */
function buildPrefs(facts: MemoryFact[] | null): Pref[] {
  return SELF_PREDICATES.map((predicate) => {
    const stored = (facts ?? [])
      .filter((f) => f.subject === 'self' && f.predicate === predicate)
      .map((f) => f.value)
      .join(' · ')
    const fallback = PREFERENCES.find((p) => LABEL_TO_PREDICATE[p.label] === predicate)?.value ?? ''
    return { predicate, label: PREDICATE_LABELS[predicate], value: stored || fallback }
  })
}

export function ProfilePage() {
  // null = 还没拿到后端画像（或后端确实没有），此时回退 mock 展示
  const [facts, setFacts] = useState<MemoryFact[] | null>(null)
  // 常用对象来自后端 contacts 表（全局公司知识）；没拿到时回退 mock 胶囊。
  const [contacts, setContacts] = useState<string[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchMemory().then(({ facts: fresh, contacts: freshContacts }) => {
      if (fresh.length > 0) setFacts(fresh)
      if (freshContacts.length > 0) setContacts(freshContacts.map((c) => c.name))
    })
  }, [])

  const prefs = buildPrefs(facts)

  function startEdit() {
    setDraft(Object.fromEntries(prefs.map((p) => [p.predicate, p.value])))
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    setError(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      // 空值整行跳过：用户清空某栏 = 删掉这条事实（后端拒绝空 value）。
      await saveFacts(
        SELF_PREDICATES.map((predicate) => ({
          subject: 'self',
          predicate,
          value: (draft[predicate] ?? '').trim(),
        })).filter((f) => f.value !== ''),
      )
      const { facts: fresh } = await fetchMemory()
      setFacts(fresh.length > 0 ? fresh : null)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <PageHeader title="我的" />

      <div className="flex flex-col gap-y-(--lto-gap-y) px-page">
        <Card className="flex items-center gap-3.5 p-4">
          {/* 占位头像：设计稿此处是扁平绿脸插画，素材待补，见文件头注释 */}
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-soft text-18 font-bold text-primary-deep">
            {PROFILE_NAME.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="text-17 font-semibold text-ink">{PROFILE_NAME}</p>
            <p className="mt-0.5 text-13 text-ink-2">{PROFILE_ROLE}</p>
          </div>
          <Badge tone="success" className="ml-auto rounded-pill px-3.5">
            {PROFILE_BADGE}
          </Badge>
        </Card>

        <Card className="px-4 py-4">
          <div className="flex items-center justify-between">
            <SectionTitle>我的偏好</SectionTitle>
            {editing ? (
              <div className="flex items-center gap-3">
                <button onClick={cancelEdit} disabled={saving} className="text-13 text-ink-3 disabled:opacity-40">
                  取消
                </button>
                <button
                  onClick={() => void save()}
                  disabled={saving}
                  className="text-13 font-medium text-primary-deep disabled:opacity-40"
                >
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            ) : (
              <button onClick={startEdit} className="text-13 font-medium text-primary-deep">
                编辑
              </button>
            )}
          </div>

          <ul className="mt-1">
            {prefs.map((p) => (
              <li key={p.predicate} className="flex items-center gap-3 py-2.5">
                <span className="shrink-0 text-14 text-ink-3">{p.label}</span>
                {editing ? (
                  <input
                    value={draft[p.predicate] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [p.predicate]: e.target.value }))}
                    placeholder="未设置"
                    className="min-w-0 flex-1 rounded-lg bg-sunken px-2.5 py-1.5 text-14 text-ink-1 outline-none"
                  />
                ) : (
                  <span className="ml-auto text-right text-14 font-medium text-ink-1">{p.value || '未设置'}</span>
                )}
              </li>
            ))}
          </ul>

          {error ? <p className="mt-1 text-13 text-danger-fg">{error}</p> : null}
        </Card>

        <Card className="px-4 py-4">
          <SectionTitle>常用对象</SectionTitle>
          <Chips items={contacts ?? CONTACTS} />

          <SectionTitle className="mt-6">历史记录</SectionTitle>
          <Chips items={HISTORY_ENTRIES} />

          <SectionTitle className="mt-6">企业信息</SectionTitle>
          <div className="mt-3 rounded-xl bg-sunken px-3.5 py-3.5">
            <p className="text-15 font-medium text-ink">{ORG_NAME}</p>
            <p className="mt-1.5 text-13 text-ink-2">{ORG_TAX}</p>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-17 font-semibold text-primary-deep ${className ?? ''}`}>{children}</h3>
}

/**
 * 胶囊组。尺寸由 UI-02/12 的实测反解得到：先量出「张总（领导）」95.0pt、
 * 「上海客户」71.0pt、「产品部同事」83.0pt，三式联立 6F+2P=95、4F+2P=71
 * ⇒ **字号 12pt、左右内边距 11.5pt**（再代回 5F+2P=83 完全吻合）。
 * 行高 38pt、间距 13pt 也是实测值。
 *
 * 这三个数不能随手放大：胶囊排一行还是两行完全卡在边界上 ——
 * 按 14pt 渲染时三个胶囊合计 326pt，超过卡片内容宽 310pt 就会换行，
 * 而设计稿明确是一行。
 */
function Chips({ items }: { items: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3.25">
      {items.map((label) => (
        <span key={label} className="rounded-pill bg-sunken px-3 py-2.75 text-12 font-medium text-ink-1">
          {label}
        </span>
      ))}
    </div>
  )
}
