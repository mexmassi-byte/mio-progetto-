import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: string
  /** Renders the option as non-selectable (e.g. already picked elsewhere). */
  disabled?: boolean
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string
  options: SelectOption[]
  /** Optional colored dot rendered before the control (e.g. driver color). */
  accent?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, accent, id, ...props }, ref) => {
    return (
      <label className="block">
        {label && (
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </span>
        )}
        <div className="relative">
          {accent && (
            <span
              className="pointer-events-none absolute left-3 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
          <select
            ref={ref}
            id={id}
            className={cn(
              'w-full appearance-none rounded-lg border border-line bg-base-900 py-2.5 pr-9 text-sm text-zinc-100 transition-colors hover:border-base-600 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40',
              accent ? 'pl-8' : 'pl-3',
              className,
            )}
            {...props}
          >
            {options.map((o) => (
              <option
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="bg-base-850 text-zinc-100 disabled:text-zinc-600"
              >
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        </div>
      </label>
    )
  },
)
Select.displayName = 'Select'
