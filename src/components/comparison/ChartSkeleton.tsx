import { Skeleton } from '@/components/ui'

/** Loading placeholder that mirrors the lap-time chart's footprint. */
export function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="ml-auto h-3.5 w-24" />
      </div>
      <Skeleton className="h-[232px] w-full" />
    </div>
  )
}
