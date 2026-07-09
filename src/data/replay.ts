/**
 * Placeholder "race replay" engine.
 *
 * Given the drivers already generated for a (grand prix, session) selection
 * and a global progress value `t` in [0, 1], it samples a live frame:
 * where each car is on the lap, its gap, position, speed, sector and tyres.
 *
 * Everything is deterministic and fake, but shaped like a real replay feed,
 * so the playback UI behaves believably. When a real telemetry source is
 * wired up later, only `sampleFrame` (and the track geometry) needs to be
 * replaced — the page consumes frames, not raw data.
 */
import type { DriverStats, GrandPrix, TyreCompound } from './comparison'

export function getTrack(index: number): string {
  return TRACKS[index % TRACKS.length]
}

// Stylised closed-loop circuits (viewBox 0 0 420 240). Purely decorative
// placeholders — a real feed would supply the actual circuit geometry.
export const TRACKS: string[] = [
  'M60,170 C40,110 70,50 130,54 C180,57 190,104 235,104 C300,104 300,50 350,64 C395,77 392,140 348,150 C300,161 300,150 250,150 C205,150 205,195 150,196 C95,197 78,205 60,170 Z',
  'M70,120 C70,70 120,50 180,60 C230,68 240,110 290,100 C330,92 330,55 365,75 C400,95 385,150 340,160 C285,172 250,150 210,165 C165,182 150,200 110,190 C78,182 70,160 70,120 Z',
  'M55,150 C50,90 110,55 170,70 C210,80 210,120 255,115 C305,109 300,60 345,72 C398,86 400,160 350,175 C300,190 260,165 215,175 C170,185 160,205 115,198 C75,192 58,190 55,150 Z',
]

/** Sector boundaries as a fraction of a lap (S1 | S2 | S3). */
export const SECTOR_BOUNDS = [0.36, 0.72] as const

export interface DriverFrame {
  data: DriverStats
  /** Position along the current lap, 0..1 — used to place the car on track. */
  lapFrac: number
  currentLap: number
  totalLaps: number
  gapToLeader: number // seconds, 0 for the leader
  position: number
  speed: number // km/h
  sector: 1 | 2 | 3
  tyreCompound: TyreCompound
  tyreAge: number
  isLeader: boolean
}

export interface Frame {
  totalLaps: number
  avgLapTime: number
  frames: DriverFrame[]
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function sectorOf(lapFrac: number): 1 | 2 | 3 {
  if (lapFrac < SECTOR_BOUNDS[0]) return 1
  if (lapFrac < SECTOR_BOUNDS[1]) return 2
  return 3
}

/** Speed profile across a lap: three accel/brake humps, scaled to top speed. */
function speedAt(lapFrac: number, topSpeed: number): number {
  const shape = 0.5 + 0.5 * Math.sin(lapFrac * Math.PI * 6 - Math.PI / 2)
  const min = 118
  return Math.round(min + (topSpeed - min) * shape)
}

export function sampleFrame(drivers: DriverStats[], gp: GrandPrix, t: number): Frame {
  const totalLaps = gp.laps
  const avgLapTime =
    drivers.reduce((s, d) => s + d.racePace, 0) / (drivers.length || 1)

  // Per-driver pace factor: faster race pace covers marginally more distance.
  const cumulative = drivers.map((d) => {
    const factor = clamp(avgLapTime / d.racePace, 0.985, 1.015)
    return t * totalLaps * factor
  })

  const leaderDist = Math.max(...cumulative, 0)

  // Positions: order the selected drivers by distance, then hand out their
  // (sorted) base grid positions so the leader shows the best number.
  const order = drivers
    .map((_, i) => i)
    .sort((a, b) => cumulative[b] - cumulative[a])
  const posPool = drivers.map((d) => d.position).sort((a, b) => a - b)
  const positionByIndex: number[] = []
  order.forEach((idx, rank) => {
    positionByIndex[idx] = posPool[rank]
  })

  const frames: DriverFrame[] = drivers.map((data, i) => {
    const dist = cumulative[i]
    const lapFrac = dist - Math.floor(dist)
    const currentLap = Math.min(totalLaps, Math.floor(dist) + 1)
    const gapToLeader = (leaderDist - dist) * avgLapTime
    return {
      data,
      lapFrac,
      currentLap,
      totalLaps,
      gapToLeader,
      position: positionByIndex[i],
      speed: speedAt(lapFrac, data.topSpeed),
      sector: sectorOf(lapFrac),
      tyreCompound: data.tyreCompound,
      tyreAge: data.tyreAge + Math.floor(dist),
      isLeader: cumulative[i] === leaderDist,
    }
  })

  return { totalLaps, avgLapTime, frames }
}

export const SPEED_OPTIONS = [0.5, 1, 2, 4] as const
export type PlaybackSpeed = (typeof SPEED_OPTIONS)[number]
