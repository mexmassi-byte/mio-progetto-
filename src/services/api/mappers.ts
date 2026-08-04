/**
 * Adapters: external API payloads → ThePaddockView domain models.
 *
 * All translation lives here, so the rest of the app never sees a wire shape.
 * If a provider changes its schema, only this file moves.
 */
import type { WireRace, WireStanding } from './jolpica'
import type { WireLap, WireSession, WireStint } from './openf1'
import type {
  Driver,
  DriverStats,
  GrandPrix,
  ChampionshipEntry,
  TyreCompound,
} from '@/domain/models'

const round = (n: number, d = 3) => Number(n.toFixed(d))

/** Standings → drivers (ordered by championship position, team included). */
export function toDrivers(standings: WireStanding[]): Driver[] {
  return standings.map((s) => ({
    id: s.Driver.driverId,
    code: s.Driver.code ?? s.Driver.familyName.slice(0, 3).toUpperCase(),
    name: `${s.Driver.givenName} ${s.Driver.familyName}`,
    team: s.Constructors[0]?.name ?? '—',
  }))
}

export function toChampionship(standings: WireStanding[], top = 6): ChampionshipEntry[] {
  return standings.slice(0, top).map((s) => ({
    rank: Number(s.position),
    driver: {
      id: s.Driver.driverId,
      code: s.Driver.code ?? s.Driver.familyName.slice(0, 3).toUpperCase(),
      name: `${s.Driver.givenName} ${s.Driver.familyName}`,
      team: s.Constructors[0]?.name ?? '—',
    },
    points: Number(s.points),
  }))
}

/**
 * Races → grands prix. `baseLap`/`baseTopSpeed`/`laps` are reference values the
 * UI uses for framing; real per-session numbers come from OpenF1 laps.
 */
export function toGrandsPrix(races: WireRace[]): GrandPrix[] {
  return races.map((r) => ({
    id: `${r.season}-${r.round}`,
    name: r.raceName.replace(' Grand Prix', ' GP'),
    circuit: r.Circuit.Location.locality,
    baseLap: 90,
    baseTopSpeed: 320,
    laps: 57,
  }))
}

/** Matches one of our grands prix to an OpenF1 session of the right type. */
export function findSession(
  sessions: WireSession[],
  circuitLocality: string,
  sessionName: string,
): WireSession | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  const target = norm(circuitLocality)
  return sessions.find(
    (s) =>
      s.session_name === sessionName &&
      (norm(s.location).includes(target) ||
        target.includes(norm(s.location)) ||
        norm(s.circuit_short_name).includes(target)),
  )
}

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1)

/** OpenF1 compound names → domain compounds. */
function toCompound(raw: string | undefined): TyreCompound {
  switch (raw?.toUpperCase()) {
    case 'SOFT':
      return 'Soft'
    case 'HARD':
      return 'Hard'
    case 'INTERMEDIATE':
      return 'Intermediate'
    case 'WET':
      return 'Wet'
    default:
      return 'Medium'
  }
}

/**
 * Tyre state at the driver's last completed lap, from the real stint data.
 * Returns null when the session has no stint coverage.
 */
function tyreAt(stints: WireStint[], lap: number): { compound: TyreCompound; age: number } | null {
  if (stints.length === 0) return null
  const ordered = [...stints].sort((a, b) => a.lap_start - b.lap_start)
  const current = [...ordered].reverse().find((s) => s.lap_start <= lap) ?? ordered[0]
  return {
    compound: toCompound(current.compound),
    age: Math.max(0, current.tyre_age_at_start + (lap - current.lap_start)),
  }
}

/**
 * Laps of one driver → `DriverStats`.
 *
 * Everything here is measured, not invented: best lap, sector bests, speed-trap
 * max, pace (mean of representative laps), consistency (lap-time spread) and —
 * when the session exposes stints — the real compound and tyre age.
 *
 * In/out laps and laps interrupted by traffic, safety cars or a pit stop are
 * excluded from the pace statistics: a single 130-second in-lap would otherwise
 * dominate the mean and wreck both the consistency score and the chart scale.
 */
export function toDriverStats(
  driver: Driver,
  laps: WireLap[],
  fallbackPosition: number,
  stints: WireStint[] = [],
): DriverStats | null {
  const clean = laps.filter(
    (l) => l.lap_duration != null && !l.is_pit_out_lap && l.lap_duration < 1000,
  )
  if (clean.length === 0) return null

  // Representative laps: within 12% of the driver's own best.
  const fastest = Math.min(...clean.map((l) => l.lap_duration as number))
  const green = clean.filter((l) => (l.lap_duration as number) <= fastest * 1.12)
  if (green.length === 0) return null

  const durations = green.map((l) => l.lap_duration as number)
  const lapTime = Math.min(...durations)
  const racePace = mean(durations)

  const bestOf = (pick: (l: WireLap) => number | null): number => {
    const vals = green.map(pick).filter((v): v is number => v != null && v > 0)
    return vals.length ? Math.min(...vals) : 0
  }
  const s1 = bestOf((l) => l.duration_sector_1)
  const s2 = bestOf((l) => l.duration_sector_2)
  const s3 = bestOf((l) => l.duration_sector_3)

  const speeds = green.map((l) => l.st_speed).filter((v): v is number => v != null && v > 0)
  const topSpeed = speeds.length ? Math.max(...speeds) : 0

  // Consistency from real lap-time spread (lower stdev → higher score).
  const m = racePace
  const stdev = Math.sqrt(mean(durations.map((d) => (d - m) ** 2)))
  const consistency = round(Math.max(50, Math.min(99.5, 100 - stdev * 3)), 1)

  // Tyre management proxy: how well pace holds between the first and last third.
  const third = Math.max(1, Math.floor(durations.length / 3))
  const drop = mean(durations.slice(-third)) - mean(durations.slice(0, third))
  const tyreManagement = round(Math.max(50, Math.min(99, 92 - drop * 12)), 1)

  const lastLap = Math.max(...green.map((l) => l.lap_number))
  const tyre = tyreAt(stints, lastLap)

  return {
    driver,
    lapTime: round(lapTime),
    topSpeed,
    s1: round(s1),
    s2: round(s2),
    s3: round(s3),
    // Real when the session publishes stints; otherwise a neutral placeholder.
    tyreCompound: tyre?.compound ?? 'Medium',
    tyreAge: tyre?.age ?? Math.min(30, green.length),
    position: fallbackPosition,
    lapSeries: durations.slice(0, 18).map((d) => round(d)),
    consistency,
    tyreManagement,
    racePace: round(racePace),
  }
}
