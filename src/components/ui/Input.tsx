import { forwardRef, type InputHTMLAttributes } from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: LucideIcon
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon: Icon, id, ...props }, ref) => {
    return (
      <label className="block">
        {label && (
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </span>
        )}
        <div className="relative">
          {Icon && (
            <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              'w-full rounded-lg border bg-base-900 py-2.5 text-sm text-zinc-100 transition-colors placeholder:text-zinc-600 focus:outline-none focus:ring-1',
              Icon ? 'pl-9 pr-3' : 'px-3',
              error
                ? 'border-accent/60 focus:border-accent focus:ring-accent/40'
                : 'border-line hover:border-line-strong focus:border-accent/60 focus:ring-accent/40',
              className,
            )}
            {...props}
          />
        </div>
        {error && <span className="mt-1 block text-xs text-accent-soft">{error}</span>}
      </label>
    )
  },
)
Input.displayName = 'Input'
