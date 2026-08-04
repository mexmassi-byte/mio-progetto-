/**
 * OpenF1 client — free, CORS-enabled telemetry API.
 *
 * **No API key required for historical data** (a paid tier exists only for
 * real-time streaming), so session lap data works straight from the browser.
 * Supplies exactly what `DriverStats` needs: lap times, the three sector
 * durations and the speed-trap reading.
 *
 * Docs: https://openf1.org  ·  Base: https://api.openf1.org/v1
 */

const BASE = import.meta.env.VITE_OPENF1_BASE_URL ?? 'https://api.openf1.org/v1'

export interface WireSession {
  session_key: number
  session_name: string
  session_type: string
  year: number
  country_name: string
  location: string
  circuit_short_name: string
  date_start: string
}

export interface WireLap {
  driver_number: number
  lap_number: number
  lap_duration: number | null
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  st_speed: number | null
  is_pit_out_lap: boolean
}

export interface WireStint {
  driver_number: number
  stint_number: number
  lap_start: number
  lap_end: number
  compound: string
  tyre_age_at_start: number
}

export interface WireOpenF1Driver {
  driver_number: number
  name_acronym: string
  full_name: string
  team_name: string
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`OpenF1 ${res.status} on ${path}`)
  return (await res.json()) as T
}

/** All sessions of a season (used to resolve a grand prix + session type). */
export async function fetchSessions(year: number, signal?: AbortSignal): Promise<WireSession[]> {
  return get<WireSession[]>(`/sessions?year=${year}`, signal)
}

/** Every lap of a session — the raw material for per-driver statistics. */
export async function fetchLaps(sessionKey: number, signal?: AbortSignal): Promise<WireLap[]> {
  return get<WireLap[]>(`/laps?session_key=${sessionKey}`, signal)
}

/** Tyre stints of a session: real compound and tyre age per lap range. */
export async function fetchStints(sessionKey: number, signal?: AbortSignal): Promise<WireStint[]> {
  return get<WireStint[]>(`/stints?session_key=${sessionKey}`, signal)
}

/** Driver numbers → acronym/team for the given session. */
export async function fetchSessionDrivers(
  sessionKey: number,
  signal?: AbortSignal,
): Promise<WireOpenF1Driver[]> {
  return get<WireOpenF1Driver[]>(`/drivers?session_key=${sessionKey}`, signal)
}

/** Maps our session labels onto OpenF1 `session_name` values. */
export const SESSION_NAME: Record<string, string> = {
  Practice: 'Practice 2',
  Qualifying: 'Qualifying',
  Sprint: 'Sprint',
  Race: 'Race',
}
