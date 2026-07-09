/**
 * Standardized domain models for ThePaddockView.
 *
 * This is the single, canonical surface for the data shapes the UI renders:
 * drivers, grands prix, sessions, race statistics and the derived analysis
 * results. UI code imports models ONLY from here (never from the data
 * implementation), so the concrete data source can change (placeholder →
 * real API) without touching a single component.
 *
 * Entity and derived types currently live in the mock implementation and are
 * re-exported here; new aggregate models are defined below.
 */

// --- Entities & core stats --------------------------------------------------
export type {
  Driver,
  GrandPrix,
  SessionType,
  TyreCompound,
  // A driver's per-session statistics.
  DriverStats,
} from '@/data/comparison'

// --- Comparison / battle results -------------------------------------------
export type {
  Winner,
  MetricKey,
  MetricRow,
  Comparison as ComparisonResult,
  BattleResult,
} from '@/data/comparison'

// --- Replay -----------------------------------------------------------------
export type {
  DriverFrame as ReplayFrame,
  Frame as ReplaySample,
  PlaybackSpeed,
} from '@/data/replay'

// --- Engineer insights ------------------------------------------------------
export type {
  Insight,
  Metric,
  InsightSection,
  InsightKind,
  MetricTone,
} from '@/data/engineer'

import type { Driver, DriverStats, SessionType } from '@/data/comparison'
import type { InsightKind } from '@/data/engineer'

/** KPI summary for a session — drives the Dashboard stat row. */
export interface SessionKpis {
  fastestLap: { seconds: number; driver: Driver }
  topSpeed: { value: number; driver: Driver }
  gapP1P2: number
  driverCount: number
}

/** One row of the session leaderboard, ordered by best lap. */
export interface LeaderboardRow {
  rank: number
  stats: DriverStats
  gap: number // seconds behind the leader (0 for P1)
}

/** Championship standings entry (placeholder points). */
export interface ChampionshipEntry {
  rank: number
  driver: Driver
  points: number
}

/** The signed-in user shown in the app shell. */
export interface CurrentUser {
  name: string
  role: string
  initials: string
}

/** A quick-action shortcut for the AI Race Engineer. */
export interface QuickAction {
  kind: InsightKind
  label: string
}

/** One Driver-DNA attribute (0–100). */
export interface DnaAttribute {
  key: string
  label: string
  value: number
}

/** A driver's complete driving-style profile for a season. */
export interface DriverDNA {
  driver: Driver
  season: string
  attributes: DnaAttribute[]
  overall: number // 0–100 average
}

/** Auto-generated race-engineer read of a Driver DNA. */
export interface DnaAnalysis {
  archetype: string
  summary: string
  strengths: DnaAttribute[]
  weaknesses: DnaAttribute[]
}

/** Convenience alias used by service method signatures. */
export type { SessionType as Session }
