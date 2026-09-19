import { MapPin, Check } from 'lucide-react'
import { Card } from './Card'
import { cn } from '../lib/cn'
import type { Restaurant } from '../lib/mock'

/**
 * 餐厅卡。全部实测自 UI-01/04.png（找餐厅屏左右留白 8.9pt，卡 x 8.4..379.2、宽 370.8）：
 *
 *   内边距四边一致 11.3 ⇒ p-2.75；照片→右列 12.8 ⇒ gap-3.25
 *   照片 146.2 × 140.6 —— **不是正方形**。原先的 size-[138px] 既小又方，
 *     是这一屏最显眼的偏差。照片与内容顶对齐，不拉伸到卡高。
 *   右列 189.3 宽，自上而下（相对卡顶；卡2/3 与卡1 在这些位置**逐条重合**）：
 *     标题行 24（text-18）               +11.3..+35.3
 *     标签行高 26、距标题行 6             +41.6..+67.6
 *     描述 行高 16、距标签 13             +81.0 起
 *     分隔线 1px、距描述 13               +109.7
 *     页脚行高 28、距分隔线 7             +118.2
 *   右列是**自然流，没有 mt-auto**：卡2/3 只有一行描述，分隔线与页脚就整体上移 16，
 *     两卡的相对位置逐条一致（+84.3/+109.7/+120.9 对 +84.6/+125.7/+137.1 减一行）。
 *     用 mt-auto 把页脚顶到卡底，卡2/3 的分隔线就会落到照片下方，一眼看得出。
 *   卡1 高 171.6、卡2/3 高 163.1，差 8.5 全部来自描述那一行；卡2/3 的右列恰好
 *     140.5，与照片等高 ⇒ 卡高由照片决定。所以照片高度是硬值，不能写成 aspect-*。
 *
 *   正文**一律 11px**，这是四处互证的结果，不是逐处估的：
 *     标签「北京特色」墨宽 44.1（4 字 ⇒ 11.2/字）、描述墨宽 179.1（16 字 ⇒ 11.3/字）、
 *     「人均」20.7（⇒ 10.7/字）、「1.2km」同档。行高 16 正好是 --text-2xs 的默认值。
 *   **价格 ¥268 是 20px 粗体**（数字墨高 14.1 ⇒ em ≈ 19.7），与「人均」基线对齐。
 *   标签底色 #f0f4f0、分隔线 #edf0ed —— 都比卡片纯白只暗一点点，是刻意的轻分隔。
 *
 * 两个使用场景共用这一个组件，避免两处各写一遍导致视觉漂移：
 *   ① 找餐厅页（UI-01 04）—— 不传 onSelect，行为与原先完全一致
 *   ② 对话内的餐厅推荐卡（UI-02 03）—— 传 onSelect，卡片可点并多一行「选这家」动作
 */
export function RestaurantCard({
  data,
  photo,
  onSelect,
  selected,
}: {
  data: Restaurant
  photo: string
  /** 传入则卡片可点选（对话内推荐卡用）；不传则纯展示（找餐厅页用） */
  onSelect?: () => void
  selected?: boolean
}) {
  const selectable = Boolean(onSelect)

  return (
    <Card
      as={selectable ? 'button' : 'div'}
      onClick={onSelect}
      // selected 用品牌绿描边表示选中。**只用边框不用底色**：底色会与卡片阴影叠出脏边，
      // 而这里 cn() 没有 tailwind-merge，边框类改写成互斥取值才不会两个都生效。
      className={cn(
        'flex items-start gap-3.25 p-2.75',
        selectable && (selected ? 'border border-primary' : 'border border-transparent'),
      )}
    >
      <div className="relative shrink-0">
        <img
          src={photo}
          alt={data.name}
          className="h-35 w-36.5 rounded-xl object-cover"
          draggable={false}
        />
        {data.recommended ? (
          /* AI 推荐角标实测 48.3 × 20.6，贴在照片左上角 */
          <span className="absolute left-0 top-0 rounded-tl-xl rounded-br-lg bg-primary px-2 py-0.5 text-2xs font-medium text-on-primary">
            AI推荐
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="truncate text-18 font-semibold text-ink">{data.name}</h3>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {data.tags.map((t) => (
            <span
              key={t}
              className="flex h-6.5 items-center rounded-lg bg-[#f0f4f0] px-3 text-2xs text-ink-2"
            >
              {t}
            </span>
          ))}
        </div>

        <p className="mt-3.25 line-clamp-2 text-2xs text-ink-2">{data.description}</p>

        <div className="mt-3.25 border-t border-[#edf0ed]" />

        {/* shrink-0 + whitespace-nowrap 是必需的：这一行没有 shrink-0 时，
            容器变窄会把「人均」压成竖排的「人」/「均」两行（对话内的卡片比
            找餐厅页窄，实测过这个断行）。价格与距离都是不可拆的原子，不该参与收缩。 */}
        <div className="mt-1.75 flex items-start justify-between gap-2">
          <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-2xs text-ink-2">
            {typeof data.distanceKm === 'number' ? (
              <>
                <MapPin className="size-2.5 text-primary" strokeWidth={1.9} />
                {data.distanceKm}km
              </>
            ) : null}
          </span>
          {typeof data.perCapita === 'number' ? (
            <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap">
              <span className="text-2xs text-ink-2">人均</span>
              <span className="text-20 font-bold text-primary">¥{data.perCapita}</span>
            </span>
          ) : (
            // 宁可写「待确认」也不要渲染一个没有数字的「¥」—— 那看起来像渲染坏了，
            // 而且「这家多少钱」恰恰是用户点这张卡最想知道的事，不能含糊过去。
            <span className="shrink-0 whitespace-nowrap text-2xs text-ink-3">人均待确认</span>
          )}
        </div>

        {/* 选中动作行。实测布局里没有这一行（找餐厅页是纯展示），
            所以只在 selectable 时渲染，不传 onSelect 的调用方布局逐像素不变。 */}
        {selectable ? (
          <span
            className={cn(
              'mt-2.75 flex h-8 items-center justify-center gap-1 rounded-pill text-13 font-medium',
              selected
                ? 'bg-primary text-on-primary'
                : 'border border-line bg-surface text-ink-1',
            )}
          >
            {selected ? <Check className="size-3.5" strokeWidth={2.2} /> : null}
            {selected ? '已选' : '选这家'}
          </span>
        ) : null}
      </div>
    </Card>
  )
}
