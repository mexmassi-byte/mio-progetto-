import { Skeleton } from './Skeleton'
import { cn } from '@/lib/cn'

export interface PanelSkeletonProps {
  /** Number of placeholder rows. */
  rows?: number
  /** Renders a large block (chart/graphic) above the rows. */
  block?: boolean
  /** Height of that block. */
  blockHeight?: string
  className?: string
}

/**
 * Generic shimmering placeholder for a card body while its data "loads".
 * Mirrors the footprint of a stat/metric panel so the layout doesn't jump.
 */
export function PanelSkeleton({
  rows = 4,
  block = false,
  blockHeight = 'h-40',
  className,
}: PanelSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {block && <Skeleton className={cn('w-full', blockHeight)} />}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3 w-28 shrink-0" />
          <Skeleton className="h-1.5 flex-1" />
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  )
}
