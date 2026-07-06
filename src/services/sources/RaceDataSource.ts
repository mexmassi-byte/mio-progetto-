/**
 * The data-source contract for ThePaddockView.
 *
 * This interface is the seam that makes the app API-ready: today it is
 * implemented by `mockSource` (deterministic placeholder data); tomorrow an
 * `httpSource` can implement the exact same contract against a real
 * Formula 1 telemetry API. Because every page talks to `raceService` (which
 * delegates to whichever source is active), swapping the implementation
 * requires no UI changes.
 *
 * NOTE ON ASYNC: methods are synchronous for now to preserve the current UI.
 * A real HTTP source is expected to prefetch/cache and expose data through
 * the same synchronous accessors (the app already models the fetch delay via
 * `useSimulatedFetch`), keeping the component layer untouched.
 */
import type {
  Driver,
  GrandPrix,
  SessionType,
  DriverStats,
  ComparisonResult,
  BattleResult,
  Insight,
  InsightKind,
  ReplaySample,
  PlaybackSpeed,
  SessionKpis,
  LeaderboardRow,
  ChampionshipEntry,
  CurrentUser,
  QuickAction,
} from '@/domain/models'

export interface RaceDataSource {
  // --- reference data ---
  getDrivers(): Driver[]
  getGrandsPrix(): GrandPrix[]
  getSessions(): SessionType[]
  getPlaybackSpeeds(): readonly PlaybackSpeed[]
  getQuickActions(): QuickAction[]
  readonly driverColors: { readonly A: string; readonly B: string }
  readonly sectorBounds: readonly number[]

  // --- per-driver stats & comparisons ---
  getDriverStats(driverId: string, gpId: string, session: SessionType): DriverStats
  getRival(driverId: string, gpId: string, session: SessionType): DriverStats
  compareDrivers(a: DriverStats, b: DriverStats): ComparisonResult
  battle(a: DriverStats, b: DriverStats): BattleResult

  // --- engineer insights ---
  getInsight(kind: InsightKind, driverId: string, gpId: string, session: SessionType): Insight
  detectInsightKind(text: string): InsightKind

  // --- replay ---
  getTrack(gpId: string): string
  sampleReplay(drivers: DriverStats[], gpId: string, t: number): ReplaySample

  // --- dashboard aggregates ---
  getSessionKpis(gpId: string, session: SessionType): SessionKpis
  getSessionLeaderboard(gpId: string, session: SessionType): LeaderboardRow[]
  getChampionship(gpId: string, session: SessionType): ChampionshipEntry[]

  // --- app ---
  getCurrentUser(): CurrentUser
}
