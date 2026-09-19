import { useState } from 'react'
import type { RestaurantOptionsCard } from '@lto/cards'
import rest1 from '../../../assets/rest-1.png'
import rest2 from '../../../assets/rest-2.png'
import rest3 from '../../../assets/rest-3.png'
import { RestaurantCard } from '../../../components/RestaurantCard'
import type { Restaurant } from '../../../lib/mock'
import type { PromptHandler } from './CardRenderer'

/**
 * 餐厅推荐卡。走 UI-01 找餐厅页那张**同一张** RestaurantCard 组件，
 * 不另做一套紧凑样式 —— 两处各写一遍必然视觉漂移（照片尺寸、标签底色、
 * 价格字号这些值都是逐屏实测标定过的，复制一份就等于复制一堆会漂的魔法数）。
 *
 * 这一屏**不套 CardShell**：每一张餐厅卡自己就是卡片，再套一层外壳会变成
 * 「卡里套卡」，阴影叠阴影。协议里的 title/badge 因此在这里不渲染。
 *
 * 照片是打包进来的静态资源（不是 URL），按序循环取。协议里的 `imageUrl`
 * 留给后端接管后使用，届时这里换成 `item.imageUrl` 即可。
 */
const PHOTOS = [rest1, rest2, rest3] as const

export function RestaurantOptionsCardView({
  card,
  onPrompt,
}: {
  card: RestaurantOptionsCard
  onPrompt: PromptHandler
}) {
  const [picked, setPicked] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2.5">
      {card.items.map((item, i) => {
        // 协议 item → 领域 Restaurant。字段名对得上，只是把可选补成必填。
        const data: Restaurant = {
          id: item.id,
          name: item.name,
          image: '',
          tags: item.tags,
          description: item.description ?? '',
          // 原样透传，**不补 0**：模型没给距离时卡片就不显示距离，
          // 补 0 会渲染成「0km」，在用户眼里是「就在楼下」—— 一个编出来的事实。
          distanceKm: item.distanceKm,
          perCapita: item.perCapita,
          recommended: item.recommended,
        }

        const selected = picked === item.id

        return (
          <RestaurantCard
            key={item.id}
            data={data}
            photo={PHOTOS[i % PHOTOS.length]}
            selected={selected}
            onSelect={() => {
              setPicked(item.id)
              onPrompt(`就选「${item.name}」`)
            }}
          />
        )
      })}
    </div>
  )
}
