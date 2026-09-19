import { cn } from '../lib/cn'

/**
 * 分段控件。UI-01 餐务页实测：浅绿轨道 + 白色浮起胶囊表示选中。
 * 用泛型约束 options，避免调用处把 value 写成 string 丢类型。
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly T[]
  value: T
  onChange: (next: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex h-11 items-center gap-1 rounded-xl bg-primary-tint p-1', className)}>
      {options.map((opt) => {
        const active = opt === value
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={cn(
              'h-9 flex-1 rounded-[10px] text-15 transition-all',
              active
                ? 'bg-surface font-semibold text-primary-deep shadow-card'
                : 'font-normal text-ink-2 active:bg-white/60',
            )}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
