/**
 * raceService — the single access point to all ThePaddockView data.
 *
 * Every page and component reads data through this service and never needs to
 * know where it comes from. To go from placeholder data to a real Formula 1
 * API, swap the `source` below for an implementation of `RaceDataSource`
 * (e.g. an `httpSource`) — no UI changes required.
 */
import { mockSource } from './sources/mockSource'
import type { RaceDataSource } from './sources/RaceDataSource'

// The active data source. Swap this line to go live.
const source: RaceDataSource = mockSource

export const raceService: RaceDataSource = source

export type { RaceDataSource } from './sources/RaceDataSource'
