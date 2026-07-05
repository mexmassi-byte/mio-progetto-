import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { Card } from './Card'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

/**
 * Neutral placeholder used by pages whose data/logic is not wired up yet.
 * Keeps the UI feeling intentional instead of "blank".
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-base-800 text-zinc-500">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        {description && (
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            {description}
          </p>
        )}
      </div>
      {action}
    </Card>
  )
}
