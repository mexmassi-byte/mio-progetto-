import { Radio } from 'lucide-react'
import { getApiStatus, isLive, dataSourceName } from '@/services/raceService'
import { useDataVersion } from '@/lib/useDataVersion'
import { cn } from '@/lib/cn'

/**
 * Says where the numbers on screen come from, honestly.
 *
 * The app renders placeholder data until the real feed resolves, and falls
 * back to it per-slice if a request fails — so a fixed label would end up
 * lying in one direction or the other. This reads the live state instead.
 */
export function DataSourceIndicator({ className }: { className?: string }) {
  useDataVersion()
  const { status } = getApiStatus()

  const state =
    dataSourceName === 'mock'
      ? { dot: 'text-zinc-500', label: 'Dati dimostrativi' }
      : isLive()
        ? { dot: 'text-signal-green', label: 'Dati reali · Jolpica + OpenF1' }
        : status === 'loading' || status === 'idle'
          ? { dot: 'text-signal-amber', label: 'Caricamento dati reali…' }
          : { dot: 'text-zinc-500', label: 'Dati dimostrativi · feed non raggiungibile' }

  return (
    <div className={cn('flex items-center gap-1.5 text-[11px] text-zinc-600', className)}>
      <Radio className={cn('h-3 w-3', state.dot)} />
      <span>{state.label}</span>
    </div>
  )
}
