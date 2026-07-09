/**
 * Placeholder grand-prix prediction engine.
 *
 * Simulates outcome probabilities for a driver at a (grand prix, season,
 * weather) from the SAME data as the rest of the app: race pace (from
 * `generateDriverData`) and driver skill (from `generateDriverDNA`). So a
 * driver who is fast in the leaderboard and strong in Driver DNA is also the
 * favourite here — the pages stay coherent. Deterministic and fake; swap
 * `generatePrediction` for a real model later.
 */
import { DRIVERS, generateDriverData, seededRandom } from './comparison'
import { generateDriverDNA } from './dna'
import { formatLapTime } from '@/lib/format'
import type { MetricTone } from './engineer'
import type {
  Prediction,
  PredictionFactor,
  WeatherCondition,
} from '@/domain/models'

export const WEATHER: WeatherCondition[] = ['Dry', 'Mixed', 'Wet']

/** Safety-car baseline per circuit (0..1) — street tracks are higher. */
const SC_BASE: Record<string, number> = {
  bhr: 0.4, sau: 0.55, aus: 0.48, imo: 0.42, mon: 0.6, esp: 0.3, gbr: 0.38, ita: 0.32,
}
/** Dry-race base pit stops per circuit. */
const PIT_SEVERITY: Record<string, number> = {
  bhr: 2, sau: 1, aus: 1, imo: 1, mon: 1, esp: 2, gbr: 2, ita: 1,
}

const round = (n: number, d = 1) => Number(n.toFixed(d))
const clampP = (n: number) => Math.max(0.5, Math.min(99, n))
const attr = (dna: ReturnType<typeof generateDriverDNA>, key: string) =>
  dna.attributes.find((a) => a.key === key)?.value ?? 70

export function generatePrediction(
  driverId: string,
  gpId: string,
  season: string,
  weather: WeatherCondition,
): Prediction {
  const driver = DRIVERS.find((d) => d.id === driverId) ?? DRIVERS[0]

  // Field data (same generators as Leaderboard / Driver DNA).
  const race: Record<string, number> = {}
  const qualy: Record<string, number> = {}
  const dna: Record<string, ReturnType<typeof generateDriverDNA>> = {}
  for (const d of DRIVERS) {
    race[d.id] = generateDriverData(d.id, gpId, 'Race').racePace
    qualy[d.id] = generateDriverData(d.id, gpId, 'Qualifying').lapTime
    dna[d.id] = generateDriverDNA(d.id, season)
  }
  const raceVals = Object.values(race)
  const qualyVals = Object.values(qualy)
  const rMin = Math.min(...raceVals)
  const rMax = Math.max(...raceVals)
  const qMin = Math.min(...qualyVals)
  const qMax = Math.max(...qualyVals)

  const jitter = (id: string, tag: string) =>
    (seededRandom(`predict|${tag}|${id}|${gpId}|${season}|${weather}`)() * 2 - 1) * 0.02
  const weatherAdj = (id: string) => {
    const f = weather === 'Wet' ? 0.22 : weather === 'Mixed' ? 0.1 : 0
    return ((attr(dna[id], 'wet') - 72) / 100) * f
  }
  const raceStrength = (id: string) =>
    ((rMax - race[id]) / (rMax - rMin || 1)) * 0.66 +
    (dna[id].overall / 100) * 0.24 +
    weatherAdj(id) +
    jitter(id, 'r')
  const qualyStrength = (id: string) =>
    ((qMax - qualy[id]) / (qMax - qMin || 1)) * 0.72 +
    (attr(dna[id], 'qualifying') / 100) * 0.2 +
    weatherAdj(id) * 0.6 +
    jitter(id, 'q')

  const myRace = raceStrength(driver.id)
  const myQualy = qualyStrength(driver.id)
  const expectedPosition = 1 + DRIVERS.filter((d) => raceStrength(d.id) > myRace).length
  const expectedQualy = 1 + DRIVERS.filter((d) => qualyStrength(d.id) > myQualy).length

  // Probability curves from the expected positions, softened by weather.
  const rnd = seededRandom(`predict|${driverId}|${gpId}|${season}|${weather}`)
  const noise = () => (rnd() * 2 - 1)
  const wetCompress = weather === 'Wet' ? 0.8 : weather === 'Mixed' ? 0.9 : 1
  const dnaRace = attr(dna[driver.id], 'racePace')

  const win = round(clampP(52 * Math.exp(-(expectedPosition - 1) * 0.6) * wetCompress + noise() * 1.5))
  const podium = round(
    clampP(88 * Math.exp(-(expectedPosition - 1) * 0.34) * (weather === 'Wet' ? 0.92 : 1) + noise() * 1.5),
  )
  const top10 = round(clampP(100 / (1 + Math.exp((expectedPosition - 9.5) * 0.72)) + noise() * 1.2))
  const pole = round(clampP(50 * Math.exp(-(expectedQualy - 1) * 0.6) * wetCompress + noise() * 1.5))
  const fastestLap = round(
    clampP(4 + 22 * Math.exp(-(expectedPosition - 1) * 0.45) + (dnaRace - 80) * 0.15 + noise()),
  )
  const scBase = SC_BASE[gpId] ?? 0.4
  const scMult = weather === 'Wet' ? 1.5 : weather === 'Mixed' ? 1.25 : 1
  const safetyCar = round(Math.max(8, Math.min(88, scBase * 100 * scMult + noise() * 2)))

  // Strategy.
  const baseStops = PIT_SEVERITY[gpId] ?? 2
  let pitStops = baseStops
  let tyreStrategy: string
  if (weather === 'Wet') {
    pitStops = baseStops + 1
    tyreStrategy = 'Full Wet → Intermediate → Slick (Medium)'
  } else if (weather === 'Mixed') {
    pitStops = baseStops + 1
    tyreStrategy = 'Crossover · Intermediate → Slick (Medium → Hard)'
  } else {
    tyreStrategy =
      baseStops <= 1
        ? 'Medium → Hard'
        : baseStops === 2
          ? 'Soft → Medium → Hard'
          : 'Soft → Soft → Medium'
  }

  // AI factors + summary.
  const wetSkill = attr(dna[driver.id], 'wet')
  const factors: PredictionFactor[] = [
    { label: 'Passo gara', value: formatLapTime(race[driver.id]), tone: 'cyan' },
    { label: 'Griglia attesa', value: `P${expectedQualy}`, tone: 'accent' as MetricTone },
    {
      label: 'Meteo',
      value: weather,
      tone: weather === 'Wet' ? 'purple' : weather === 'Mixed' ? 'amber' : 'cyan',
    },
    { label: 'Wet skill', value: `${wetSkill}`, tone: wetSkill >= 85 ? 'green' : 'amber' },
    { label: 'Safety Car', value: `${safetyCar}%`, tone: safetyCar >= 55 ? 'amber' : 'neutral' },
  ]

  const weatherIT = weather === 'Wet' ? 'pista bagnata' : weather === 'Mixed' ? 'condizioni miste' : 'asciutto'
  const bracket =
    expectedPosition <= 3 ? 'nel gruppo di testa' : expectedPosition <= 8 ? 'a ridosso della zona punti alta' : 'nel centro-gruppo'
  const weatherNote =
    weather === 'Dry'
      ? 'Scenario stabile: conta il passo puro e la gestione gomme.'
      : `Con ${weatherIT} cresce la variabilità (Safety Car ${safetyCar}%) e pesa la guida sul bagnato (${wetSkill}/100).`
  const summary =
    `${driver.name} è dato vincente al ${win}% e sul podio al ${podium}%, con griglia attesa P${expectedQualy} e passo gara ${formatLapTime(race[driver.id])} — ${bracket}. ` +
    `${weatherNote} ` +
    `Strategia consigliata: ${tyreStrategy} su ${pitStops} sosta${pitStops === 1 ? '' : 'e'}; probabilità Top 10 ${top10}%, pole ${pole}%, giro veloce ${fastestLap}%.`

  return {
    driver,
    gpId,
    season,
    weather,
    expectedPosition,
    probabilities: { win, podium, top10, pole, fastestLap, safetyCar },
    tyreStrategy,
    pitStops,
    factors,
    summary,
  }
}
