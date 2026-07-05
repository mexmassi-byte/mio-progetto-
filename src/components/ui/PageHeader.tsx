import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { Badge } from './Badge'

export interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  badge?: string
  actions?: ReactNode
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  badge,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-base-800 text-accent-soft">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              {title}
            </h1>
            {badge && <Badge tone="cyan">{badge}</Badge>}
          </div>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
