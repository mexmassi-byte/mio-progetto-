/**
 * raceService — the single access point to all ThePaddockView data.
 *
 * Every page and component reads data through this service and never needs to
 * know where it comes from.
 *
 * Active source is chosen by `VITE_DATA_SOURCE`:
 *   • `api`  (default) → real Formula 1 data from Jolpica-F1 + OpenF1, both
 *     free and key-less, with automatic per-slice fallback to the mock so the
 *     UI never breaks offline or while loading.
 *   • `mock`           → fully deterministic placeholder data.
 *   • `http`           → the empty skeleton for a future private/paid API.
 */
import { mockSource } from './sources/mockSource'
import { apiSource } from './sources/apiSource'
import type { RaceDataSource } from './sources/RaceDataSource'

// When the real API is ready behind a key, activate the HTTP skeleton instead:
//   import { httpSource } from './sources/httpSource'

type SourceName = 'api' | 'mock' | 'http'
const configured = (import.meta.env.VITE_DATA_SOURCE ?? 'api') as SourceName

const source: RaceDataSource = configured === 'mock' ? mockSource : apiSource

export const raceService: RaceDataSource = source

/** Which source is configured — surfaced in the UI as a data-origin badge. */
export const dataSourceName: SourceName = configured

export type { RaceDataSource } from './sources/RaceDataSource'
export {
  bootstrap,
  getApiStatus,
  getDataVersion,
  isLive,
  subscribeApiStatus,
} from './sources/apiSource'
