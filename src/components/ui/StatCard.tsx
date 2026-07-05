import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Card } from './Card'

export interface StatCardProps {
  label: string
  value: string
  icon?: LucideIcon
  /** e.g. "+2.3%" — colored by `trend`. */
  delta?: string
  trend?: 'up' | 'down' | 'flat'
  hint?: string
}

const trendColor: Record<NonNullable<StatCardProps['trend']>, string> = {
  up: 'text-signal-green',
  down: 'text-accent-soft',
  flat: 'text-zinc-500',
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  trend = 'flat',
  hint,
}: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-zinc-600" />}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="tabular text-2xl font-semibold text-zinc-100">
          {value}
        </span>
        {delta && (
          <span className={cn('tabular text-xs font-medium', trendColor[trend])}>
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-zinc-600">{hint}</p>}
    </Card>
  )
}
