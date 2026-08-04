import { isLive, dataSourceName } from '@/services/raceService'
import { useDataVersion } from './useDataVersion'

/**
 * The one-line provenance note pages print under their title.
 *
 * It has to be computed, not written: the same screen shows real telemetry
 * when the feed resolves and placeholder values when it does not, and a fixed
 * sentence would be wrong half the time.
 */
export function useDataNote(): string {
  useDataVersion()
  return dataSourceName !== 'mock' && isLive()
    ? 'Dati reali di Formula 1 (Jolpica-F1 + OpenF1).'
    : 'Dati dimostrativi coerenti, nessuna telemetria reale collegata.'
}

/** Short form for inline badges. */
export function useDataBadge(): string {
  useDataVersion()
  return dataSourceName !== 'mock' && isLive() ? 'live' : 'demo'
}
