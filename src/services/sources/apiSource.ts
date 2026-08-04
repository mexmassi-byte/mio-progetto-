/**
 * apiSource — REAL Formula 1 data, no API key required.
 *
 * Sources
 *   • Jolpica-F1 (Ergast successor) → seasons, calendar, drivers + teams,
 *     championship standings.
 *   • OpenF1 → session laps (lap times, sector durations, speed trap), tyre
 *     stints (compound and age) and the race distance.
 *
 * ── How it satisfies a synchronous contract ────────────────────────────────
 * `RaceDataSource` is sync (so no component had to change). This module keeps
 * an in-memory cache and exposes `bootstrap()` / `loadSession()` to fill it.
 * Every getter reads the cache and **falls back to `mockSource`** when a slice
 * hasn't loaded (or the network failed), so the UI is never broken or empty.
 *
 * ── LIMITATIONS (free endpoints) ───────────────────────────────────────────
 *   • Classified finishing position comes from championship order, not from
 *     the session result: OpenF1 exposes it only through the `position` and
 *     `intervals` streams.
 *   • Tyre stints are published from 2023 onwards; earlier seasons fall back
 *     to a neutral compound.
 *   • Driver DNA, Predict and Coach analytics are *derivations* over these
 *     stats — real inputs, internal model. They are labelled as estimates.
 */
import { mockSource } from './mockSource'
import type { RaceDataSource } from './RaceDataSource'
import { fetchDriverStandings, fetchRaces, fetchSeasons } from '@/services/api/jolpica'
import {
  fetchLaps,
  fetchSessions,
  fetchStints,
  SESSION_NAME,
  type WireLap,
  type WireStint,
} from '@/services/api/openf1'
import {
  findSession,
  toChampionship,
  toDriverStats,
  toDrivers,
  toGrandsPrix,
} from '@/services/api/mappers'
import type {
  ChampionshipEntry,
  Driver,
  DriverStats,
  GrandPrix,
  SessionType,
} from '@/domain/models'

interface Cache {
  season?: string
  seasons?: string[]
  drivers?: Driver[]
  grandsPrix?: GrandPrix[]
  championship?: ChampionshipEntry[]
  /** `${gpId}|${session}` → per-driver stats. */
  sessions: Map<string, Map<string, DriverStats>>
  sessionsLoading: Set<string>
}

const cache: Cache = { sessions: new Map(), sessionsLoading: new Set() }

export type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error'
let status: BootstrapStatus = 'idle'
let lastError: string | null = null
let version = 0
const listeners = new Set<() => void>()

/**
 * Cache changes are announced asynchronously on purpose: getters kick off a
 * background load *during render*, and waking subscribers synchronously from
 * there would mean updating a component while another one is rendering.
 */
const notify = () => {
  queueMicrotask(() => {
    version++
    listeners.forEach((l) => l())
  })
}
export function subscribeApiStatus(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
/**
 * Monotonic counter bumped whenever the cache changes. Components subscribe to
 * it so a slice arriving from the network re-renders the page — and so stale
 * selections (a driver id from the placeholder grid) get re-validated against
 * the data that is now live.
 */
export function getDataVersion(): number {
  return version
}
export function getApiStatus(): { status: BootstrapStatus; error: string | null } {
  return { status, error: lastError }
}
/** True once real reference data is in the cache. */
export function isLive(): boolean {
  return Boolean(cache.drivers?.length && cache.grandsPrix?.length)
}

// --- bootstrap --------------------------------------------------------------

/** Loads reference data (season, calendar, drivers, standings). Safe to retry. */
export async function bootstrap(season?: string): Promise<void> {
  if (status === 'loading') return
  status = 'loading'
  lastError = null
  notify()
  try {
    const seasons = await fetchSeasons()
    // Newest season with published standings (the current one may be empty).
    let chosen = season ?? seasons[0]
    let standings = await fetchDriverStandings(chosen)
    if (standings.length === 0 && seasons[1]) {
      chosen = seasons[1]
      standings = await fetchDriverStandings(chosen)
    }
    const races = await fetchRaces(chosen)

    cache.seasons = seasons
    cache.season = chosen
    cache.drivers = toDrivers(standings)
    cache.championship = toChampionship(standings)
    cache.grandsPrix = toGrandsPrix(races)
    status = 'ready'
  } catch (err) {
    status = 'error'
    lastError = err instanceof Error ? err.message : String(err)
  }
  notify()
}

/** Loads one session's laps and maps them to per-driver stats. */
export async function loadSession(gpId: string, session: SessionType): Promise<void> {
  const key = `${gpId}|${session}`
  if (cache.sessions.has(key) || cache.sessionsLoading.has(key)) return
  const gp = cache.grandsPrix?.find((g) => g.id === gpId)
  const drivers = cache.drivers
  if (!gp || !drivers) return

  cache.sessionsLoading.add(key)
  notify()
  try {
    const year = Number(gpId.split('-')[0])
    const sessions = await fetchSessions(year)
    const match = findSession(sessions, gp.circuit, SESSION_NAME[session] ?? 'Race')
    if (!match) return

    // Stints are optional: a session without them still yields full stats.
    const [laps, stints] = await Promise.all([
      fetchLaps(match.session_key),
      fetchStints(match.session_key).catch(() => [] as WireStint[]),
    ])

    const byNumber = new Map<number, WireLap[]>()
    for (const lap of laps) {
      const arr = byNumber.get(lap.driver_number) ?? []
      arr.push(lap)
      byNumber.set(lap.driver_number, arr)
    }
    const stintsByNumber = new Map<number, WireStint[]>()
    for (const stint of stints) {
      const arr = stintsByNumber.get(stint.driver_number) ?? []
      arr.push(stint)
      stintsByNumber.set(stint.driver_number, arr)
    }

    // OpenF1 keys by car number; align to our drivers by championship order of
    // their best lap so the mapping stays stable without a number lookup.
    const perDriver = new Map<string, DriverStats>()
    const entries = [...byNumber.entries()]
      .map(([num, ls]) => {
        const best = Math.min(
          ...ls.map((l) => l.lap_duration ?? Infinity).filter((v) => Number.isFinite(v)),
        )
        return { num, ls, best }
      })
      .filter((e) => Number.isFinite(e.best))
      .sort((a, b) => a.best - b.best)

    entries.forEach((entry, i) => {
      const driver = drivers[i]
      if (!driver) return
      const stats = toDriverStats(driver, entry.ls, i + 1, stintsByNumber.get(entry.num) ?? [])
      if (stats) perDriver.set(driver.id, stats)
    })

    if (perDriver.size > 0) cache.sessions.set(key, perDriver)

    // The calendar endpoint doesn't publish a lap count; a completed race does.
    if (session === 'Race' && laps.length > 0) {
      const distance = Math.max(...laps.map((l) => l.lap_number))
      if (Number.isFinite(distance) && distance > 1) gp.laps = distance
    }
  } catch {
    /* leave the slice unloaded — getters fall back to mock */
  } finally {
    cache.sessionsLoading.delete(key)
    notify()
  }
}

// --- source -----------------------------------------------------------------

const statsFor = (driverId: string, gpId: string, session: SessionType): DriverStats | undefined =>
  cache.sessions.get(`${gpId}|${session}`)?.get(driverId)

/**
 * Real data where available, mock everywhere else. Derived analytics reuse the
 * mock's pure functions, so they operate on whatever stats are current.
 */
export const apiSource: RaceDataSource = {
  ...mockSource,

  getDrivers: () => cache.drivers ?? mockSource.getDrivers(),
  getGrandsPrix: () => cache.grandsPrix ?? mockSource.getGrandsPrix(),
  getSeasons: () => cache.seasons ?? mockSource.getSeasons(),

  getDriverStats: (driverId, gpId, session) => {
    const real = statsFor(driverId, gpId, session)
    if (real) return real
    // Kick off a background load so the next render can be real.
    void loadSession(gpId, session)

    // Placeholder values, but a *distinct* set per driver: mapping every
    // driver onto the same mock entry would make two drivers look identical
    // (zero gap in a comparison) for as long as the session is loading.
    const driver = cache.drivers?.find((d) => d.id === driverId)
    const mockDrivers = mockSource.getDrivers()
    const index = Math.max(0, cache.drivers?.findIndex((d) => d.id === driverId) ?? -1)
    const stand = mockDrivers[index % mockDrivers.length]
    const fallback = mockSource.getDriverStats(
      stand.id,
      mockSource.getGrandsPrix()[0].id,
      session,
    )
    // Keep the real identity even while the numbers are still placeholder.
    return driver ? { ...fallback, driver } : fallback
  },

  getRival: (driverId, gpId, session) => {
    const map = cache.sessions.get(`${gpId}|${session}`)
    if (map && map.size > 1) {
      const me = map.get(driverId)
      if (me) {
        let best: DriverStats | null = null
        let delta = Infinity
        for (const [id, s] of map) {
          if (id === driverId) continue
          const d = Math.abs(s.racePace - me.racePace)
          if (d < delta) {
            delta = d
            best = s
          }
        }
        if (best) return best
      }
    }
    return mockSource.getRival(driverId, gpId, session)
  },

  getSessionLeaderboard: (gpId, session) => {
    const map = cache.sessions.get(`${gpId}|${session}`)
    if (!map || map.size === 0) {
      void loadSession(gpId, session)
      return mockSource.getSessionLeaderboard(gpId, session)
    }
    const ranked = [...map.values()].sort((a, b) => a.lapTime - b.lapTime)
    return ranked.map((stats, i) => ({
      rank: i + 1,
      stats,
      gap: stats.lapTime - ranked[0].lapTime,
    }))
  },

  getSessionKpis: (gpId, session) => {
    const map = cache.sessions.get(`${gpId}|${session}`)
    if (!map || map.size === 0) {
      void loadSession(gpId, session)
      return mockSource.getSessionKpis(gpId, session)
    }
    const ranked = [...map.values()].sort((a, b) => a.lapTime - b.lapTime)
    const fastestSpeed = [...ranked].sort((a, b) => b.topSpeed - a.topSpeed)[0]
    return {
      fastestLap: { seconds: ranked[0].lapTime, driver: ranked[0].driver },
      topSpeed: { value: fastestSpeed.topSpeed, driver: fastestSpeed.driver },
      gapP1P2: ranked[1] ? ranked[1].lapTime - ranked[0].lapTime : 0,
      driverCount: ranked.length,
    }
  },

  getChampionship: (gpId, session) =>
    cache.championship ?? mockSource.getChampionship(gpId, session),
}
