import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a subtle hover elevation — useful for interactive/clickable cards. */
  interactive?: boolean
}

export function Card({ className, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-base-900/80 shadow-panel backdrop-blur-sm transition-all duration-200',
        interactive &&
          'cursor-pointer hover:-translate-y-0.5 hover:border-line-strong hover:bg-base-850 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.9)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-line px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-zinc-100">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}
