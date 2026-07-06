/**
 * Mock data layer for the Driver Comparison dashboard.
 *
 * Everything here is FAKE but deterministic: the same
 * (driver, grand prix, session) selection always yields the same numbers,
 * so the UI reacts believably when the user changes a dropdown. When real
 * telemetry is wired up later, only this module needs to be replaced —
 * the page consumes it through `generateDriverData` / `buildComparison`.
 */

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

export const DRIVERS: Driver[] = [
  { id: 'ver', code: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing' },
  { id: 'nor', code: 'NOR', name: 'Lando Norris', team: 'McLaren' },
  { id: 'lec', code: 'LEC', name: 'Charles Leclerc', team: 'Ferrari' },
  { id: 'ham', code: 'HAM', name: 'Lewis Hamilton', team: 'Mercedes' },
  { id: 'pia', code: 'PIA', name: 'Oscar Piastri', team: 'McLaren' },
  { id: 'sai', code: 'SAI', name: 'Carlos Sainz', team: 'Williams' },
  { id: 'rus', code: 'RUS', name: 'George Russell', team: 'Mercedes' },
  { id: 'per', code: 'PER', name: 'Sergio Pérez', team: 'Red Bull Racing' },
  { id: 'alo', code: 'ALO', name: 'Fernando Alonso', team: 'Aston Martin' },
  { id: 'gas', code: 'GAS', name: 'Pierre Gasly', team: 'Alpine' },
]

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

// ---------------------------------------------------------------------------
// Per-driver placeholder metrics
// ---------------------------------------------------------------------------

export interface DriverData {
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
}

export function generateDriverData(
  driverId: string,
  gpId: string,
  session: SessionType,
): DriverData {
  const driver = DRIVERS.find((d) => d.id === driverId) ?? DRIVERS[0]
  const gp = GRANDS_PRIX.find((g) => g.id === gpId) ?? GRANDS_PRIX[0]
  const rnd = mulberry32(hashString(`${driverId}|${gpId}|${session}`))

  // Sessions have slightly different pace envelopes.
  const sessionPace: Record<SessionType, number> = {
    Practice: 0.9,
    Qualifying: -0.4,
    Sprint: 0.3,
    Race: 0.6,
  }

  const lapTime = round(gp.baseLap + sessionPace[session] + (rnd() * 1.4 - 0.5), 3)
  const topSpeed = Math.round(gp.baseTopSpeed + (rnd() * 12 - 5))

  const s1 = round(lapTime * 0.3 + (rnd() * 0.3 - 0.15), 3)
  const s2 = round(lapTime * 0.41 + (rnd() * 0.3 - 0.15), 3)
  const s3 = round(lapTime - s1 - s2, 3)

  const tyreCompound = TYRE_COMPOUNDS[Math.floor(rnd() * TYRE_COMPOUNDS.length)]
  const tyreAge = Math.floor(rnd() * 24)
  const position = 1 + Math.floor(rnd() * 10)

  const points = 18
  const lapSeries = Array.from({ length: points }, (_, i) => {
    // gentle warm-up, mid-stint plateau, small pit-window dip
    const drift = Math.sin((i / points) * Math.PI) * 0.4
    const pit = i === Math.floor(points * 0.55) ? 1.6 : 0
    return round(lapTime + drift + pit + (rnd() * 0.5 - 0.2), 3)
  })

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

function fmtLap(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = (sec - m * 60).toFixed(3).padStart(6, '0')
  return `${m}:${s}`
}

/** Gap (seconds) between the two drivers, derived from best-lap delta. */
export function deriveGap(a: DriverData, b: DriverData): number {
  return round((a.lapTime - b.lapTime) * 6, 2)
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

export function buildComparison(a: DriverData, b: DriverData): Comparison {
  const gap = deriveGap(a, b) // >0 means A slower (behind)
  const gapA = gap
  const gapB = -gap
  const fmtGap = (g: number) => `${g > 0 ? '+' : ''}${g.toFixed(2)}s`

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
