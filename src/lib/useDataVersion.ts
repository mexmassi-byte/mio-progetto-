import { useSyncExternalStore } from 'react'
import { getDataVersion, subscribeApiStatus } from '@/services/raceService'

/**
 * Re-renders the caller whenever the data layer's cache changes.
 *
 * The `RaceDataSource` contract is synchronous by design, but the real feed
 * arrives asynchronously: the grid, the calendar and each session load after
 * first paint. This hook turns those cache updates into a render signal, and
 * its return value is a stable dependency for the `useMemo`s that read the
 * service — so a page shows placeholder data first and real data the moment
 * it lands, without any component knowing how it got there.
 */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribeApiStatus, getDataVersion, getDataVersion)
}
