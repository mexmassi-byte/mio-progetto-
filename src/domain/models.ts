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
import type { InsightKind, MetricTone } from '@/data/engineer'

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

/** Weather scenario for a race simulation. */
export type WeatherCondition = 'Dry' | 'Mixed' | 'Wet'

/** Outcome probabilities (0–100) for a simulated grand prix. */
export interface PredictionProbabilities {
  win: number
  podium: number
  top10: number
  pole: number
  fastestLap: number
  safetyCar: number
}

/** A highlighted driver of the prediction (shown in the AI summary). */
export interface PredictionFactor {
  label: string
  value: string
  tone: MetricTone
}

/** Result of a grand-prix simulation for a driver/team. */
export interface Prediction {
  driver: Driver
  gpId: string
  season: string
  weather: WeatherCondition
  expectedPosition: number
  probabilities: PredictionProbabilities
  tyreStrategy: string
  pitStops: number
  factors: PredictionFactor[]
  summary: string
}

// --- AI Coach ---------------------------------------------------------------

/** A scored coach indicator (0–100) with a display value. */
export interface CoachMetric {
  key: string
  label: string
  value: number
  display: string
  tone: MetricTone
}

/** An event marker on the analysed-session timeline. */
export interface CoachTimelineEvent {
  lap: number
  label: string
  tone: MetricTone
}

/** The auto-generated insight panel for a driver/session. */
export interface CoachInsights {
  driver: Driver
  season: string
  sessionLabel: string
  strengths: string[]
  weaknesses: string[]
  metrics: CoachMetric[]
  confidence: number
  code: string
  refCode: string
  lapSeries: number[]
  refLapSeries: number[]
  timeline: CoachTimelineEvent[]
}

/** A race-engineer answer to a coach question. */
export interface CoachAnswer {
  title: string
  text: string
  confidence: number
  metrics: CoachMetric[]
  focus?: string
}

// --- Account ----------------------------------------------------------------

/**
 * Access level. ThePaddockView is sold as a ONE-TIME purchase — there is no
 * recurring subscription: an account either has preview access or, after the
 * purchase, permanent full access.
 */
export type AccountAccess = 'Preview' | 'Full'

/** The signed-in account (placeholder — no real backend yet). */
export interface Account {
  id: string
  firstName: string
  lastName: string
  username: string
  email: string
  access: AccountAccess
  /** ISO date of the one-time purchase; undefined while on preview. */
  purchasedAt?: string
  favoriteDriverId: string
  favoriteTeam: string
  favoriteGpId: string
  createdAt: string // ISO
}

/** Aggregate usage statistics shown on the profile. */
export interface ProfileStats {
  analyses: number
  favorites: number
  sessions: number
}

/** An entry in the account's recent-activity list. */
export interface RecentAnalysis {
  id: string
  label: string
  detail: string
  to: string
  when: string
}

/** Payload for creating an account. */
export interface SignupInput {
  firstName: string
  lastName: string
  username: string
  email: string
  password: string
}

/** The single one-time product sold (no recurring billing). */
export interface Product {
  id: string
  name: string
  /** Amount in minor units (cents) — avoids float issues at checkout. */
  amount: number
  currency: string
  /** Preformatted price, e.g. "€29,99". */
  priceDisplay: string
  /** What the purchase unlocks. */
  includes: string[]
}

/** A product notification shown in the notification centre. */
export type NotificationKind = 'update' | 'analysis' | 'feature' | 'ai' | 'system'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  /** Human-readable relative time. */
  time: string
  /** Optional route the notification links to. */
  to?: string
  read: boolean
}

/** Outcome of a checkout attempt. */
export interface CheckoutResult {
  status: 'completed' | 'cancelled'
  /** Set by a real provider: the hosted-checkout URL to redirect to. */
  redirectUrl?: string
}

/** Convenience alias used by service method signatures. */
export type { SessionType as Session }
