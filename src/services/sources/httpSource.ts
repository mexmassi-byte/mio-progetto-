/**
 * httpSource — SKELETON / GUIDE (not active).
 * ---------------------------------------------------------------------------
 * A template implementation of `RaceDataSource` for a future real Formula 1
 * API. It performs NO network calls and pulls in NO external dependencies:
 * the data methods throw `notImplemented(...)`, while the purely-static config
 * (sessions, playback speeds, colors, sector layout, quick actions) is already
 * filled in.
 *
 * To go live later:
 *   1. Implement the `notImplemented` methods below (see the commented sketches).
 *   2. In `raceService.ts`, swap `mockSource` for `httpSource`.
 *   3. The UI does not change — it already reads everything through
 *      `raceService`.
 *
 * ── Sync vs. async ─────────────────────────────────────────────────────────
 * `RaceDataSource` is intentionally SYNCHRONOUS so the component layer stays
 * untouched. A real HTTP source bridges async → sync with a small cache:
 *
 *   • `prefetch(gpId, session)` (async) loads reference data + the session
 *     snapshot into `cache`, gated by a loading state — the app already models
 *     that delay with `useSimulatedFetch`, so the seam is in place.
 *   • the sync getters simply read from `cache`.
 *
 * ── Endpoint map (suggested) ───────────────────────────────────────────────
 *   getDrivers            GET  /drivers
 *   getGrandsPrix         GET  /grands-prix
 *   getDriverStats        GET  /sessions/{gp}/{session}/drivers/{id}/stats
 *   getSessionLeaderboard GET  /sessions/{gp}/{session}/leaderboard
 *   getSessionKpis        GET  /sessions/{gp}/{session}/kpis
 *   getChampionship       GET  /championship?upTo={gp}
 *   getTrack              GET  /circuits/{gp}/path
 *   sampleReplay          GET  /sessions/{gp}/{session}/replay?t={t}   (or a stream)
 *
 * Note: comparisons, battles, insights and replay sampling are DERIVED. They
 * can stay client-side (reuse the same pure functions as the mock) or be
 * served by the API — this skeleton leaves that choice to the implementer.
 */
import type { RaceDataSource } from './RaceDataSource'
import type {
  PlaybackSpeed,
  QuickAction,
  SessionType,
  WeatherCondition,
} from '@/domain/models'

// Base URL for the future API, from an env var at build time (see
// .env.example). Falls back to the same-origin "/api/v1" when unset.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/**
 * Thin fetch wrapper — the template every data method would use. It is not
 * invoked anywhere yet; the real request is left commented out so the file
 * stays inert and dependency-free.
 */
export class RaceApiClient {
  constructor(private readonly baseUrl: string = API_BASE_URL) {}

  async get<T>(path: string, _params?: Record<string, string | number>): Promise<T> {
    // const url = new URL(this.baseUrl + path, window.location.origin)
    // if (_params) {
    //   for (const [k, v] of Object.entries(_params)) url.searchParams.set(k, String(v))
    // }
    // const res = await fetch(url, { headers: { Accept: 'application/json' } })
    // if (!res.ok) throw new Error(`API ${res.status} on ${path}`)
    // return (await res.json()) as T
    throw new Error(`RaceApiClient is a skeleton (GET ${this.baseUrl}${path})`)
  }
}

/** Marks a data method that still needs a real implementation. */
function notImplemented(method: string): never {
  throw new Error(
    `[httpSource] "${method}" is not implemented yet. Wire it to the API ` +
      `(see RaceApiClient) and activate httpSource in raceService.ts.`,
  )
}

// --- Static app config (not API data) --------------------------------------
// These are product configuration, so they live client-side even once the
// data is real. Kept in sync with the mock source on purpose.
const SESSIONS: SessionType[] = ['Practice', 'Qualifying', 'Sprint', 'Race']
const SEASONS: string[] = ['2025', '2024', '2023']
const WEATHER: WeatherCondition[] = ['Dry', 'Mixed', 'Wet']
const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [0.5, 1, 2, 4]
const DRIVER_COLORS = { A: '#e10600', B: '#0ea5c4' } as const
const SECTOR_BOUNDS: readonly number[] = [0.36, 0.72]
const QUICK_ACTIONS: QuickAction[] = [
  { kind: 'pace', label: 'Ritmo gara' },
  { kind: 'strategy', label: 'Strategia & pit' },
  { kind: 'rival', label: 'Rivale diretto' },
  { kind: 'swot', label: 'Forza / debolezza' },
]

// Example of the cache a real implementation would populate via `prefetch`:
//
//   const client = new RaceApiClient()
//   const cache: {
//     drivers?: Driver[]
//     grandsPrix?: GrandPrix[]
//     statsByKey: Map<string, DriverStats>
//   } = { statsByKey: new Map() }
//
//   export async function prefetch(gpId: string, session: SessionType) {
//     cache.drivers ??= await client.get<Driver[]>('/drivers')
//     cache.grandsPrix ??= await client.get<GrandPrix[]>('/grands-prix')
//     // ...load the session snapshot here...
//   }

export const httpSource: RaceDataSource = {
  // --- static config (already implemented) ---
  getSessions: () => [...SESSIONS],
  getPlaybackSpeeds: () => PLAYBACK_SPEEDS,
  getQuickActions: () => QUICK_ACTIONS,
  driverColors: DRIVER_COLORS,
  sectorBounds: SECTOR_BOUNDS,

  // --- reference data (from the API) ---
  // Real sketch, once `prefetch` has populated the cache:
  //   getDrivers: () => cache.drivers ?? notImplemented('getDrivers (prefetch first)'),
  getDrivers: () => notImplemented('getDrivers'),
  getGrandsPrix: () => notImplemented('getGrandsPrix'),

  // --- per-driver stats & comparisons ---
  getDriverStats: (_driverId, _gpId, _session) => notImplemented('getDriverStats'),
  getRival: (_driverId, _gpId, _session) => notImplemented('getRival'),
  // Derived — could reuse the same pure `buildComparison`/`buildBattle`:
  compareDrivers: (_a, _b) => notImplemented('compareDrivers'),
  battle: (_a, _b) => notImplemented('battle'),

  // --- engineer insights (derived) ---
  getInsight: (_kind, _driverId, _gpId, _session) => notImplemented('getInsight'),
  detectInsightKind: (_text) => notImplemented('detectInsightKind'),

  // --- driver DNA ---
  getSeasons: () => [...SEASONS],
  getDriverDNA: (_driverId, _season) => notImplemented('getDriverDNA'),
  analyzeDNA: (_dna) => notImplemented('analyzeDNA'),

  // --- prediction ---
  getWeatherConditions: () => [...WEATHER],
  getPrediction: (_driverId, _gpId, _season, _weather) => notImplemented('getPrediction'),

  // --- replay ---
  getTrack: (_gpId) => notImplemented('getTrack'),
  sampleReplay: (_drivers, _gpId, _t) => notImplemented('sampleReplay'),

  // --- dashboard aggregates ---
  getSessionKpis: (_gpId, _session) => notImplemented('getSessionKpis'),
  getSessionLeaderboard: (_gpId, _session) => notImplemented('getSessionLeaderboard'),
  getChampionship: (_gpId, _session) => notImplemented('getChampionship'),

  // --- app ---
  getCurrentUser: () => notImplemented('getCurrentUser'),
}
