/**
 * Jolpica-F1 client — the maintained successor to the (now retired) Ergast API.
 *
 * Public, free and CORS-enabled: **no API key or account required**, so this
 * runs straight from the browser. Serves the reference data: seasons, the race
 * calendar, drivers with their constructor, and championship standings.
 *
 * Docs: https://github.com/jolpica/jolpica-f1  ·  Base: https://api.jolpi.ca/ergast/f1
 */

const BASE = import.meta.env.VITE_JOLPICA_BASE_URL ?? 'https://api.jolpi.ca/ergast/f1'

// --- wire shapes (only the fields we consume) ------------------------------

interface WireDriver {
  driverId: string
  code?: string
  permanentNumber?: string
  givenName: string
  familyName: string
}
interface WireConstructor {
  constructorId: string
  name: string
}
interface WireCircuit {
  circuitId: string
  circuitName: string
  Location: { locality: string; country: string }
}
interface WireRace {
  season: string
  round: string
  raceName: string
  Circuit: WireCircuit
  date: string
}
interface WireStanding {
  position: string
  points: string
  Driver: WireDriver
  Constructors: WireConstructor[]
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Jolpica ${res.status} on ${path}`)
  return (await res.json()) as T
}

/** Seasons available, newest first (capped — we only surface recent ones). */
export async function fetchSeasons(limit = 5, signal?: AbortSignal): Promise<string[]> {
  const json = await get<{ MRData: { SeasonTable: { Seasons: { season: string }[] } } }>(
    `/seasons.json?limit=100`,
    signal,
  )
  return json.MRData.SeasonTable.Seasons.map((s) => s.season)
    .sort((a, b) => Number(b) - Number(a))
    .slice(0, limit)
}

/** Race calendar for a season. */
export async function fetchRaces(season: string, signal?: AbortSignal): Promise<WireRace[]> {
  const json = await get<{ MRData: { RaceTable: { Races: WireRace[] } } }>(
    `/${season}/races.json?limit=100`,
    signal,
  )
  return json.MRData.RaceTable.Races
}

/**
 * Championship standings — the single call that gives drivers, their team and
 * their points, already ordered by competitiveness.
 */
export async function fetchDriverStandings(
  season: string,
  signal?: AbortSignal,
): Promise<WireStanding[]> {
  const json = await get<{
    MRData: { StandingsTable: { StandingsLists: { DriverStandings: WireStanding[] }[] } }
  }>(`/${season}/driverStandings.json?limit=100`, signal)
  return json.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []
}

export type { WireRace, WireStanding, WireDriver, WireConstructor }
