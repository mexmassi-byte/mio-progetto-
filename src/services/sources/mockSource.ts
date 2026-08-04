/**
 * Placeholder data source.
 *
 * Implements `RaceDataSource` on top of the deterministic mock generators in
 * `@/data/*`. This is the ONLY module that imports those internals — the rest
 * of the app goes through `raceService`. Replacing this file with an
 * `httpSource` (same interface) is all it takes to go live.
 */
import {
  DRIVERS,
  GRANDS_PRIX,
  SESSIONS,
  DRIVER_COLORS,
  generateDriverData,
  buildComparison,
  buildBattle,
} from '@/data/comparison'
import {
  getTrack as getTrackByIndex,
  sampleFrame,
  SPEED_OPTIONS,
  SECTOR_BOUNDS,
} from '@/data/replay'
import { buildInsight, detectKind, pickRival, QUICK_ACTIONS } from '@/data/engineer'
import { SEASONS, generateDriverDNA, analyzeDriverDNA } from '@/data/dna'
import { WEATHER, generatePrediction } from '@/data/predict'
import {
  COACH_SESSIONS,
  COACH_PROMPTS,
  generateCoachInsights,
  askCoach,
} from '@/data/coach'
import { generateNotifications } from '@/data/notifications'
import type { RaceDataSource } from './RaceDataSource'
import type {
  ChampionshipEntry,
  CurrentUser,
  DriverStats,
  LeaderboardRow,
  SessionKpis,
  SessionType,
} from '@/domain/models'

const CURRENT_USER: CurrentUser = {
  name: 'Max Verstappen',
  role: 'Team Principal',
  initials: 'MV',
}

/** Generate every driver's stats for a session (basis for aggregates). */
function allStats(gpId: string, session: SessionType): DriverStats[] {
  return DRIVERS.map((d) => generateDriverData(d.id, gpId, session))
}

function rankedByLap(gpId: string, session: SessionType): DriverStats[] {
  return [...allStats(gpId, session)].sort((a, b) => a.lapTime - b.lapTime)
}

export const mockSource: RaceDataSource = {
  // reference data
  getDrivers: () => DRIVERS,
  getGrandsPrix: () => GRANDS_PRIX,
  getSessions: () => [...SESSIONS],
  getPlaybackSpeeds: () => SPEED_OPTIONS,
  getQuickActions: () => QUICK_ACTIONS,
  driverColors: DRIVER_COLORS,
  sectorBounds: SECTOR_BOUNDS,

  // per-driver stats & comparisons
  getDriverStats: (driverId, gpId, session) => generateDriverData(driverId, gpId, session),
  getRival: (driverId, gpId, session) => pickRival(driverId, gpId, session),
  compareDrivers: (a, b) => buildComparison(a, b),
  battle: (a, b) => buildBattle(a, b),

  // engineer insights
  getInsight: (kind, driverId, gpId, session) => buildInsight(kind, driverId, gpId, session),
  detectInsightKind: (text) => detectKind(text),

  // driver DNA
  getSeasons: () => [...SEASONS],
  getDriverDNA: (driverId, season) => generateDriverDNA(driverId, season),
  analyzeDNA: (dna) => analyzeDriverDNA(dna),

  // prediction
  getWeatherConditions: () => [...WEATHER],
  getPrediction: (driverId, gpId, season, weather) =>
    generatePrediction(driverId, gpId, season, weather),

  // AI coach
  getCoachSessions: () => [...COACH_SESSIONS],
  getCoachPrompts: () => [...COACH_PROMPTS],
  getCoachInsights: (driverId, gpId, season, coachSession) =>
    generateCoachInsights(driverId, gpId, season, coachSession),
  askCoach: (question, driverId, gpId, season, coachSession) =>
    askCoach(question, driverId, gpId, season, coachSession),

  // replay
  getTrack: (gpId) => getTrackByIndex(GRANDS_PRIX.findIndex((g) => g.id === gpId)),
  sampleReplay: (drivers, gpId, t) =>
    sampleFrame(drivers, GRANDS_PRIX.find((g) => g.id === gpId) ?? GRANDS_PRIX[0], t),

  // dashboard aggregates
  getSessionKpis: (gpId, session): SessionKpis => {
    const ranked = rankedByLap(gpId, session)
    const fastestSpeed = [...ranked].sort((a, b) => b.topSpeed - a.topSpeed)[0]
    return {
      fastestLap: { seconds: ranked[0].lapTime, driver: ranked[0].driver },
      topSpeed: { value: fastestSpeed.topSpeed, driver: fastestSpeed.driver },
      gapP1P2: ranked[1].lapTime - ranked[0].lapTime,
      driverCount: DRIVERS.length,
    }
  },
  getSessionLeaderboard: (gpId, session): LeaderboardRow[] => {
    const ranked = rankedByLap(gpId, session)
    return ranked.map((stats, i) => ({
      rank: i + 1,
      stats,
      gap: stats.lapTime - ranked[0].lapTime,
    }))
  },
  getChampionship: (gpId, session): ChampionshipEntry[] => {
    const ranked = rankedByLap(gpId, session)
    return ranked.slice(0, 6).map((s, i) => ({
      rank: i + 1,
      driver: s.driver,
      points: Math.max(0, 300 - i * 24 - (s.position % 5) * 3),
    }))
  },

  // notifications
  getNotifications: () => generateNotifications(),

  // app
  getCurrentUser: () => CURRENT_USER,
}
