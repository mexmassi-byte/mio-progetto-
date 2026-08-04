import { Skeleton } from '@/components/ui'

/**
 * Shown while a code-split page chunk loads. Mirrors the standard page
 * layout (header, controls, content grid) so the switch to the real page
 * doesn't shift anything.
 */
export function RouteFallback() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-3 border-b border-line pb-6">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-full max-w-xl" />
        </div>
      </div>
      {/* Controls */}
      <Skeleton className="h-24 w-full rounded-xl" />
      {/* Content */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
