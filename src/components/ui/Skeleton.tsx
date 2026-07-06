import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * Shimmering placeholder block for elegant loading states. Composed into
 * page-specific skeletons (e.g. a chart loader) while the (simulated)
 * telemetry "loads".
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-md bg-base-800', className)}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  )
}
