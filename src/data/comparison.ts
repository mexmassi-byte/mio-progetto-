/**
 * Mock data layer (the placeholder F1 dataset + generators behind
 * `mockSource`). Everything here is FAKE but deterministic: the same
 * (driver, grand prix, session) selection always yields the same numbers, so
 * every page shows identical values. Reached only through `raceService`.
 *
 * ── Extending the dataset (data-only, no structural changes) ────────────────
 *   • New driver .......... add a row to `GRID` (and a `TEAMS` entry if the
 *                           team is new). Its `id` becomes selectable everywhere.
 *   • New team ............ add an entry to `TEAMS` with its pace/top-speed tier.
 *   • New grand prix ...... add an entry to `GRANDS_PRIX`.
 *   • New season .......... swap `TEAMS` + `GRID` + `GRANDS_PRIX` for the new
 *                           season's values (same shapes).
 *   • New statistic ....... add a field to `DriverStats`, set it in
 *                           `generateDriverData`, then read it in the UI.
 */

import { formatLapTime, formatGap } from '@/lib/format'

// Validated categorical series colors (see dataviz palette check).
export const DRIVER_COLORS = {
  A: '#e10600', // F1 red
  B: '#0ea5c4', // deep telemetry cyan
} as const

export interface Driver {
  id: string
  code: string // 3-letter code
  name: string
  team: string
}

/**
 * Team performance model.
 *
 * `pace` is the car's deficit in seconds to the fastest reference car;
 * `topSpeed` is a km/h delta. Together they create a realistic pecking order:
 * top teams within a few tenths, a clear midfield, and backmarkers well over a
 * second off. `tier` is used only to reason about the grid — it is not shown.
 */
type Tier = 'top' | 'midfield' | 'backmarker'
interface TeamPerf {
  name: string
  tier: Tier
  pace: number // seconds off the ultimate pace
  topSpeed: number // km/h delta vs. circuit reference
}

const TEAMS = {
  mclaren: { name: 'McLaren', tier: 'top', pace: 0.0, topSpeed: 1 },
  redbull: { name: 'Red Bull Racing', tier: 'top', pace: 0.16, topSpeed: 2 },
  ferrari: { name: 'Ferrari', tier: 'top', pace: 0.24, topSpeed: 0 },
  mercedes: { name: 'Mercedes', tier: 'top', pace: 0.32, topSpeed: 3 },
  williams: { name: 'Williams', tier: 'midfield', pace: 0.72, topSpeed: 2 },
  rb: { name: 'Racing Bulls', tier: 'midfield', pace: 0.84, topSpeed: 1 },
  aston: { name: 'Aston Martin', tier: 'midfield', pace: 0.95, topSpeed: -1 },
  haas: { name: 'Haas', tier: 'midfield', pace: 1.05, topSpeed: 0 },
  alpine: { name: 'Alpine', tier: 'backmarker', pace: 1.28, topSpeed: -2 },
  sauber: { name: 'Kick Sauber', tier: 'backmarker', pace: 1.46, topSpeed: -3 },
} satisfies Record<string, TeamPerf>

type TeamId = keyof typeof TEAMS

/**
 * Grid definition: [id, code, name, teamId, skill].
 * `skill` is the driver's intra-team pace delta in seconds (0 = team leader),
 * producing plausible team-mate gaps. Order roughly follows competitiveness.
 */
const GRID: [string, string, string, TeamId, number][] = [
  ['pia', 'PIA', 'Oscar Piastri', 'mclaren', 0.0],
  ['nor', 'NOR', 'Lando Norris', 'mclaren', 0.03],
  ['ver', 'VER', 'Max Verstappen', 'redbull', 0.0],
  ['tsu', 'TSU', 'Yuki Tsunoda', 'redbull', 0.32],
  ['lec', 'LEC', 'Charles Leclerc', 'ferrari', 0.0],
  ['ham', 'HAM', 'Lewis Hamilton', 'ferrari', 0.12],
  ['rus', 'RUS', 'George Russell', 'mercedes', 0.0],
  ['ant', 'ANT', 'Kimi Antonelli', 'mercedes', 0.22],
  ['alb', 'ALB', 'Alex Albon', 'williams', 0.0],
  ['sai', 'SAI', 'Carlos Sainz', 'williams', 0.07],
  ['had', 'HAD', 'Isack Hadjar', 'rb', 0.0],
  ['law', 'LAW', 'Liam Lawson', 'rb', 0.1],
  ['alo', 'ALO', 'Fernando Alonso', 'aston', 0.0],
  ['str', 'STR', 'Lance Stroll', 'aston', 0.2],
  ['oco', 'OCO', 'Esteban Ocon', 'haas', 0.0],
  ['bea', 'BEA', 'Oliver Bearman', 'haas', 0.1],
  ['gas', 'GAS', 'Pierre Gasly', 'alpine', 0.0],
  ['col', 'COL', 'Franco Colapinto', 'alpine', 0.24],
  ['hul', 'HUL', 'Nico Hülkenberg', 'sauber', 0.0],
  ['bor', 'BOR', 'Gabriel Bortoleto', 'sauber', 0.19],
]

export const DRIVERS: Driver[] = GRID.map(([id, code, name, teamId]) => ({
  id,
  code,
  name,
  team: TEAMS[teamId].name,
}))

/** Internal per-driver performance profile (not part of the public model). */
interface Profile {
  paceDelta: number // total pace deficit (team + skill), seconds
  topSpeedDelta: number
  rating: number // 0..1, 1 = fastest reference (drives consistency/tyre mgmt)
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

const PROFILES: Record<string, Profile> = Object.fromEntries(
  GRID.map(([id, , , teamId, skill]): [string, Profile] => {
    const team = TEAMS[teamId]
    const paceDelta = team.pace + skill
    return [
      id,
      {
        paceDelta,
        topSpeedDelta: team.topSpeed,
        rating: clamp01(1 - paceDelta / 1.9),
      },
    ]
  }),
)

export interface GrandPrix {
  id: string
  name: string
  circuit: string
  /** Reference lap length in seconds — shapes the placeholder numbers. */
  baseLap: number
  baseTopSpeed: number
  laps: number
}

export const GRANDS_PRIX: GrandPrix[] = [
  { id: 'bhr', name: 'Bahrain GP', circuit: 'Sakhir', baseLap: 91.5, baseTopSpeed: 322, laps: 57 },
  { id: 'sau', name: 'Saudi Arabian GP', circuit: 'Jeddah', baseLap: 88.9, baseTopSpeed: 331, laps: 50 },
  { id: 'aus', name: 'Australian GP', circuit: 'Melbourne', baseLap: 79.2, baseTopSpeed: 318, laps: 58 },
  { id: 'imo', name: 'Emilia-Romagna GP', circuit: 'Imola', baseLap: 76.4, baseTopSpeed: 312, laps: 63 },
  { id: 'mon', name: 'Monaco GP', circuit: 'Monte Carlo', baseLap: 72.3, baseTopSpeed: 290, laps: 78 },
  { id: 'esp', name: 'Spanish GP', circuit: 'Barcelona', baseLap: 78.1, baseTopSpeed: 316, laps: 66 },
  { id: 'gbr', name: 'British GP', circuit: 'Silverstone', baseLap: 87.0, baseTopSpeed: 320, laps: 52 },
  { id: 'ita', name: 'Italian GP', circuit: 'Monza', baseLap: 81.6, baseTopSpeed: 351, laps: 53 },
]

export const SESSIONS = ['Practice', 'Qualifying', 'Sprint', 'Race'] as const
export type SessionType = (typeof SESSIONS)[number]

export const TYRE_COMPOUNDS = ['Soft', 'Medium', 'Hard'] as const
export type TyreCompound = (typeof TYRE_COMPOUNDS)[number]

// ---------------------------------------------------------------------------
// Deterministic pseudo-random helpers
// ---------------------------------------------------------------------------

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number, d = 2) => Number(n.toFixed(d))

/** Deterministic RNG seeded from a string key (shared across the data layer). */
export function seededRandom(key: string): () => number {
  return mulberry32(hashString(key))
}

// Sessions have slightly different pace envelopes (qualy is the fastest).
const SESSION_PACE: Record<SessionType, number> = {
  Practice: 0.9,
  Qualifying: -0.4,
  Sprint: 0.3,
  Race: 0.6,
}

/**
 * Small, deterministic per-(driver, gp, session) variation added on top of the
 * static team+driver pace. Uses its own seed namespace so the ordering it
 * produces is identical whether we compute a lap time or a grid position.
 */
function paceNoise(driverId: string, gpId: string, session: SessionType): number {
  const rnd = mulberry32(hashString(`pace|${driverId}|${gpId}|${session}`))
  return (rnd() * 2 - 1) * 0.06 // ±0.06s
}

/** A driver's effective pace deficit for a session (team + skill + variation). */
function effectivePace(driverId: string, gpId: string, session: SessionType): number {
  return (PROFILES[driverId]?.paceDelta ?? 1) + paceNoise(driverId, gpId, session)
}

// ---------------------------------------------------------------------------
// Per-driver placeholder metrics
// ---------------------------------------------------------------------------

export interface DriverStats {
  driver: Driver
  lapTime: number // seconds (best lap)
  topSpeed: number // km/h
  s1: number
  s2: number
  s3: number
  tyreCompound: TyreCompound
  tyreAge: number // laps on current set
  position: number
  /** Lap-by-lap best sector-normalised lap times, for the trend chart. */
  lapSeries: number[]
  // --- derived performance scores (used by Battle Mode) ---
  consistency: number // 0-100, higher = steadier lap times
  tyreManagement: number // 0-100, higher = better deg control
  racePace: number // seconds, average lap (lower = faster)
}

export function generateDriverData(
  driverId: string,
  gpId: string,
  session: SessionType,
): DriverStats {
  const driver = DRIVERS.find((d) => d.id === driverId) ?? DRIVERS[0]
  const gp = GRANDS_PRIX.find((g) => g.id === gpId) ?? GRANDS_PRIX[0]
  const profile = PROFILES[driver.id] ?? { paceDelta: 1, topSpeedDelta: 0, rating: 0.4 }
  const rnd = mulberry32(hashString(`${driver.id}|${gpId}|${session}`))

  // Lap time = circuit base + session envelope + this car/driver's real deficit.
  const pace = effectivePace(driver.id, gpId, session)
  const lapTime = round(gp.baseLap + SESSION_PACE[session] + pace, 3)
  const topSpeed = Math.round(gp.baseTopSpeed + profile.topSpeedDelta + (rnd() * 6 - 3))

  const s1 = round(lapTime * 0.3 + (rnd() * 0.2 - 0.1), 3)
  const s2 = round(lapTime * 0.41 + (rnd() * 0.2 - 0.1), 3)
  const s3 = round(lapTime - s1 - s2, 3)

  const tyreCompound = TYRE_COMPOUNDS[Math.floor(rnd() * TYRE_COMPOUNDS.length)]
  const tyreAge = Math.floor(rnd() * 24)

  // Grid position = rank across the whole field by effective pace, so top
  // teams line up at the front and backmarkers at the rear (with a little mix).
  const position =
    1 + DRIVERS.filter((d) => effectivePace(d.id, gpId, session) < pace).length

  // Lap-by-lap trace for the chart; less scatter for higher-rated drivers.
  const points = 18
  const noiseAmp = 0.05 + (1 - profile.rating) * 0.1
  const lapSeries = Array.from({ length: points }, (_, i) => {
    const drift = Math.sin((i / points) * Math.PI) * 0.22
    const pit = i === Math.floor(points * 0.55) ? 1.4 : 0
    return round(lapTime + drift + pit + (rnd() * 2 - 1) * noiseAmp, 3)
  })

  const racePace = round(
    lapSeries.reduce((s, v) => s + v, 0) / lapSeries.length,
    3,
  )
  // Consistency & tyre management track driver rating for a believable spread.
  const consistency = round(
    Math.min(99.2, Math.max(84, 86 + profile.rating * 12 + (rnd() * 3 - 1.5))),
    1,
  )
  const tyreManagement = round(
    Math.min(98, Math.max(72, 76 + profile.rating * 20 + (rnd() * 6 - 3))),
    1,
  )

  return {
    driver,
    lapTime,
    topSpeed,
    s1,
    s2,
    s3,
    tyreCompound,
    tyreAge,
    position,
    lapSeries,
    consistency,
    tyreManagement,
    racePace,
  }
}

// ---------------------------------------------------------------------------
// Comparison / summary logic
// ---------------------------------------------------------------------------

export type MetricKey =
  | 'lapTime'
  | 'topSpeed'
  | 's1'
  | 's2'
  | 's3'
  | 'tyreCompound'
  | 'tyreAge'
  | 'gap'
  | 'position'
  | 'consistency'
  | 'tyreManagement'
  | 'racePace'

export type Winner = 'A' | 'B' | 'tie'

export interface MetricRow {
  key: MetricKey
  label: string
  /** Raw comparable numbers (compound mapped to a pace rank). */
  rawA: number
  rawB: number
  /** Display strings. */
  displayA: string
  displayB: string
  winner: Winner
  /** 0..1 share of the bar filled toward A (for the advantage bar). */
  shareA: number
  hint?: string
}

const compoundRank: Record<TyreCompound, number> = { Soft: 3, Medium: 2, Hard: 1 }

const fmtLap = formatLapTime

/** Gap (seconds) between the two drivers, derived from best-lap delta. */
export function deriveGap(a: DriverStats, b: DriverStats): number {
  // Scale the best-lap delta into a plausible on-track interval: team-mates
  // land within a few tenths, a top car vs. a backmarker a handful of seconds.
  return round((a.lapTime - b.lapTime) * 3.5, 2)
}

interface RowSpec {
  key: MetricKey
  label: string
  a: number
  b: number
  higherBetter: boolean
  displayA: string
  displayB: string
  hint?: string
}

function toRow(spec: RowSpec): MetricRow {
  const { a, b, higherBetter } = spec
  let winner: Winner = 'tie'
  if (a !== b) winner = (higherBetter ? a > b : a < b) ? 'A' : 'B'

  // Advantage bar: normalise the gap into a 0..1 share around 0.5.
  const max = Math.max(Math.abs(a), Math.abs(b), 1)
  const norm = (a - b) / max // -1..1, positive means A larger
  const towardA = higherBetter ? norm : -norm
  const shareA = Math.min(0.92, Math.max(0.08, 0.5 + towardA * 0.5))

  return {
    key: spec.key,
    label: spec.label,
    rawA: a,
    rawB: b,
    displayA: spec.displayA,
    displayB: spec.displayB,
    winner,
    shareA,
    hint: spec.hint,
  }
}

export interface Comparison {
  rows: MetricRow[]
  scoreA: number
  scoreB: number
  gap: number
}

export function buildComparison(a: DriverStats, b: DriverStats): Comparison {
  const gap = deriveGap(a, b) // >0 means A slower (behind)
  const gapA = gap
  const gapB = -gap
  const fmtGap = (g: number) => formatGap(g)

  const rows: MetricRow[] = [
    toRow({
      key: 'lapTime',
      label: 'Lap Time',
      a: a.lapTime,
      b: b.lapTime,
      higherBetter: false,
      displayA: fmtLap(a.lapTime),
      displayB: fmtLap(b.lapTime),
    }),
    toRow({
      key: 'topSpeed',
      label: 'Top Speed',
      a: a.topSpeed,
      b: b.topSpeed,
      higherBetter: true,
      displayA: `${a.topSpeed} km/h`,
      displayB: `${b.topSpeed} km/h`,
    }),
    toRow({
      key: 's1',
      label: 'Sector 1',
      a: a.s1,
      b: b.s1,
      higherBetter: false,
      displayA: `${a.s1.toFixed(3)}s`,
      displayB: `${b.s1.toFixed(3)}s`,
    }),
    toRow({
      key: 's2',
      label: 'Sector 2',
      a: a.s2,
      b: b.s2,
      higherBetter: false,
      displayA: `${a.s2.toFixed(3)}s`,
      displayB: `${b.s2.toFixed(3)}s`,
    }),
    toRow({
      key: 's3',
      label: 'Sector 3',
      a: a.s3,
      b: b.s3,
      higherBetter: false,
      displayA: `${a.s3.toFixed(3)}s`,
      displayB: `${b.s3.toFixed(3)}s`,
    }),
    toRow({
      key: 'tyreCompound',
      label: 'Tyre Compound',
      a: compoundRank[a.tyreCompound],
      b: compoundRank[b.tyreCompound],
      higherBetter: true,
      displayA: a.tyreCompound,
      displayB: b.tyreCompound,
      hint: 'softer = più passo teorico',
    }),
    toRow({
      key: 'tyreAge',
      label: 'Tyre Age',
      a: a.tyreAge,
      b: b.tyreAge,
      higherBetter: false,
      displayA: `${a.tyreAge} laps`,
      displayB: `${b.tyreAge} laps`,
      hint: 'più fresche = vantaggio',
    }),
    toRow({
      key: 'gap',
      label: 'Gap to Rival',
      a: gapA,
      b: gapB,
      higherBetter: false,
      displayA: fmtGap(gapA),
      displayB: fmtGap(gapB),
    }),
    toRow({
      key: 'position',
      label: 'Position',
      a: a.position,
      b: b.position,
      higherBetter: false,
      displayA: `P${a.position}`,
      displayB: `P${b.position}`,
    }),
  ]

  const scoreA = rows.filter((r) => r.winner === 'A').length
  const scoreB = rows.filter((r) => r.winner === 'B').length

  return { rows, scoreA, scoreB, gap }
}

// ---------------------------------------------------------------------------
// Battle Mode — a leaner, performance-oriented head-to-head
// ---------------------------------------------------------------------------

export interface BattleResult {
  rows: MetricRow[]
  scoreA: number
  scoreB: number
  /** Overall winner across all categories. */
  overall: Winner
}

export function buildBattle(a: DriverStats, b: DriverStats): BattleResult {
  const rows: MetricRow[] = [
    toRow({
      key: 'lapTime',
      label: 'Lap Time',
      a: a.lapTime,
      b: b.lapTime,
      higherBetter: false,
      displayA: fmtLap(a.lapTime),
      displayB: fmtLap(b.lapTime),
    }),
    toRow({
      key: 'topSpeed',
      label: 'Top Speed',
      a: a.topSpeed,
      b: b.topSpeed,
      higherBetter: true,
      displayA: `${a.topSpeed} km/h`,
      displayB: `${b.topSpeed} km/h`,
    }),
    toRow({
      key: 's1',
      label: 'Sector 1',
      a: a.s1,
      b: b.s1,
      higherBetter: false,
      displayA: `${a.s1.toFixed(3)}s`,
      displayB: `${b.s1.toFixed(3)}s`,
    }),
    toRow({
      key: 's2',
      label: 'Sector 2',
      a: a.s2,
      b: b.s2,
      higherBetter: false,
      displayA: `${a.s2.toFixed(3)}s`,
      displayB: `${b.s2.toFixed(3)}s`,
    }),
    toRow({
      key: 's3',
      label: 'Sector 3',
      a: a.s3,
      b: b.s3,
      higherBetter: false,
      displayA: `${a.s3.toFixed(3)}s`,
      displayB: `${b.s3.toFixed(3)}s`,
    }),
    toRow({
      key: 'consistency',
      label: 'Consistency',
      a: a.consistency,
      b: b.consistency,
      higherBetter: true,
      displayA: `${a.consistency.toFixed(1)}%`,
      displayB: `${b.consistency.toFixed(1)}%`,
    }),
    toRow({
      key: 'tyreManagement',
      label: 'Tyre Management',
      a: a.tyreManagement,
      b: b.tyreManagement,
      higherBetter: true,
      displayA: `${a.tyreManagement.toFixed(1)}%`,
      displayB: `${b.tyreManagement.toFixed(1)}%`,
    }),
    toRow({
      key: 'racePace',
      label: 'Race Pace',
      a: a.racePace,
      b: b.racePace,
      higherBetter: false,
      displayA: fmtLap(a.racePace),
      displayB: fmtLap(b.racePace),
    }),
  ]

  const scoreA = rows.filter((r) => r.winner === 'A').length
  const scoreB = rows.filter((r) => r.winner === 'B').length
  const overall: Winner = scoreA === scoreB ? 'tie' : scoreA > scoreB ? 'A' : 'B'

  return { rows, scoreA, scoreB, overall }
}
