/**
 * Placeholder "Driver DNA" model.
 *
 * Produces a deterministic driving-style profile (10 attributes, 0–100) per
 * (driver, season), plus a rule-based race-engineer analysis of it. Driver
 * skill here is car-independent (a midfield driver can still be elite), so the
 * DNA reads as a driver profile rather than a car ranking. Deterministic and
 * fake — swap `generateDriverDNA` for a real source later.
 */
import { DRIVERS, seededRandom } from './comparison'
import type { DnaAnalysis, DnaAttribute, Driver, DriverDNA } from '@/domain/models'

export const SEASONS = ['2025', '2024', '2023'] as const

/** The 10 Driver-DNA attributes, in display order. */
export const DNA_ATTRIBUTES: { key: string; label: string }[] = [
  { key: 'qualifying', label: 'Qualifying Pace' },
  { key: 'racePace', label: 'Race Pace' },
  { key: 'tyres', label: 'Tyre Management' },
  { key: 'overtaking', label: 'Overtaking' },
  { key: 'defending', label: 'Defensive Skills' },
  { key: 'aggression', label: 'Aggressiveness' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'wet', label: 'Wet Weather' },
  { key: 'starts', label: 'Starts' },
  { key: 'pressure', label: 'Pressure Handling' },
]

/** Car-independent driver quality (0..1) — drives the DNA baseline. */
const DRIVER_SKILL: Record<string, number> = {
  ver: 0.98, alo: 0.96, ham: 0.95, lec: 0.92, nor: 0.9, pia: 0.89, rus: 0.88,
  sai: 0.87, gas: 0.84, alb: 0.83, oco: 0.82, hul: 0.81, tsu: 0.79, law: 0.76,
  ant: 0.76, had: 0.75, bea: 0.74, str: 0.72, col: 0.72, bor: 0.7,
}

/** Signature traits that nudge specific attributes, for believable profiles. */
const SIGNATURES: Record<string, Partial<Record<string, number>>> = {
  ver: { aggression: 10, overtaking: 8, pressure: 6, wet: 4 },
  alo: { defending: 12, wet: 8, pressure: 8, tyres: 6, racePace: 4 },
  ham: { wet: 10, racePace: 6, consistency: 4, starts: 4 },
  lec: { qualifying: 10, aggression: 4 },
  nor: { qualifying: 6, consistency: 4 },
  pia: { consistency: 6, tyres: 4, pressure: 4 },
  rus: { qualifying: 6, starts: 4 },
  sai: { tyres: 6, defending: 6, starts: 6 },
  alb: { defending: 8, tyres: 6 },
  gas: { wet: 6, starts: 4 },
  oco: { defending: 6, aggression: 6 },
  hul: { qualifying: 6, wet: 6 },
  tsu: { aggression: 8, qualifying: 4 },
  str: { wet: 8 },
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function generateDriverDNA(driverId: string, season: string): DriverDNA {
  const driver: Driver = DRIVERS.find((d) => d.id === driverId) ?? DRIVERS[0]
  const skill = DRIVER_SKILL[driver.id] ?? 0.8
  const signature = SIGNATURES[driver.id] ?? {}
  const rnd = seededRandom(`dna|${driver.id}|${season}`)

  const base = 42 + skill * 48 // ~74 (rookies) … ~89 (elite)

  const attributes: DnaAttribute[] = DNA_ATTRIBUTES.map(({ key, label }) => {
    const bias = signature[key] ?? 0
    const variation = (rnd() * 2 - 1) * 11
    const value = Math.round(clamp(base + bias + variation, 40, 99))
    return { key, label, value }
  })

  const overall = Math.round(
    attributes.reduce((s, a) => s + a.value, 0) / attributes.length,
  )

  return { driver, season, attributes, overall }
}

// --- AI analysis ------------------------------------------------------------

function pickArchetype(byKey: Record<string, number>): string {
  const {
    qualifying = 0,
    racePace = 0,
    overtaking = 0,
    aggression = 0,
    defending = 0,
    consistency = 0,
    tyres = 0,
    wet = 0,
  } = byKey
  if (wet >= 88) return 'Rain Master'
  if (qualifying >= 88 && qualifying - racePace >= 6) return 'Qualifying Specialist'
  if (racePace >= 86 && tyres >= 84) return 'Sunday Racer'
  if (overtaking >= 85 && aggression >= 85) return 'Aggressive Overtaker'
  if (defending >= 85 && consistency >= 85) return 'Cool Operator'
  if (qualifying >= 82 && racePace >= 82 && consistency >= 82) return 'Complete Package'
  return 'Balanced All-Rounder'
}

export function analyzeDriverDNA(dna: DriverDNA): DnaAnalysis {
  const sorted = [...dna.attributes].sort((a, b) => b.value - a.value)
  const strengths = sorted.slice(0, 3)
  const weaknesses = sorted.slice(-2).reverse()
  const byKey = Object.fromEntries(dna.attributes.map((a) => [a.key, a.value]))
  const archetype = pickArchetype(byKey)

  const strong = strengths.map((s) => s.label.toLowerCase()).join(', ')
  const weak = weaknesses[weaknesses.length - 1]
  const tierWord =
    dna.overall >= 88 ? 'top-tier' : dna.overall >= 80 ? 'solid' : 'developing'

  const summary =
    `${dna.driver.name} profila come un ${archetype.toLowerCase()} ${tierWord} ` +
    `(indice DNA ${dna.overall}). I punti di forza sono ${strong}, ` +
    `mentre ${weak.label.toLowerCase()} (${weak.value}) resta l'area su cui lavorare. ` +
    `Profilo coerente da sfruttare nella costruzione del weekend.`

  return { archetype, summary, strengths, weaknesses }
}
