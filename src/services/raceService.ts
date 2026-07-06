/**
 * raceService — the single access point to all ThePaddockView data.
 *
 * Every page and component reads data through this service and never needs to
 * know where it comes from. To go from placeholder data to a real Formula 1
 * API, swap the `source` below for an implementation of `RaceDataSource`
 * (e.g. an `httpSource`) — no UI changes required.
 */
import { mockSource } from './sources/mockSource'
// When the real API is ready, activate the HTTP source instead of the mock:
//   import { httpSource } from './sources/httpSource'
//   const source: RaceDataSource = httpSource
import type { RaceDataSource } from './sources/RaceDataSource'

// The active data source. Swap this single line to go live — no UI changes.
const source: RaceDataSource = mockSource

export const raceService: RaceDataSource = source

export type { RaceDataSource } from './sources/RaceDataSource'
