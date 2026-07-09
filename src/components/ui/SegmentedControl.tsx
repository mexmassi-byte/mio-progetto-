import { cn } from '@/lib/cn'

export interface SegmentedControlProps<T extends string> {
  label?: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}

/**
 * Compact segmented toggle used for small, fixed option sets (e.g. the session
 * selector). Replaces the ad-hoc button rows previously duplicated per page.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div>
      {label && (
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
      )}
      <div className="flex rounded-lg border border-line bg-base-900 p-0.5">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              option === value
                ? 'bg-base-700 text-white'
                : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
