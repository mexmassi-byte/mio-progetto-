/**
 * Persisted analysis selections.
 *
 * Every page picks its cockpit setup (driver, grand prix, season, session,
 * weather) through these hooks, so the choices survive a reload and stay
 * consistent across the app.
 *
 * Selections are always resolved against the data that is live *right now*.
 * That matters because the real F1 feed replaces the placeholder grid and
 * calendar after first paint: an id that was valid a moment ago (or a
 * hardcoded default) can disappear. Instead of handing the page a value that
 * no longer resolves — which used to crash it — the hook falls back, during
 * render, to the page's preferred default and finally to the first available
 * option. Pages can therefore keep using `find(...)!` safely.
 */
import { useEffect } from 'react'
import { usePersistentState } from './usePersistentState'
import { useDataVersion } from './useDataVersion'
import { raceService } from '@/services/raceService'
import type { SessionType, WeatherCondition } from '@/domain/models'

const driverIds = () => raceService.getDrivers().map((d) => d.id)
const gpIds = () => raceService.getGrandsPrix().map((g) => g.id)

interface ResolveOptions {
  /** Empty string is a legitimate value (optional second-driver slots). */
  allowEmpty?: boolean
  /**
   * Which entry of the live list to use when the named default is missing.
   * Pages comparing two entities pass 0 and 1 so they never land on the same
   * one after a data swap.
   */
  nth?: number
}

/**
 * Keeps `value` inside `options`, preferring the page's default. Resolution
 * happens during render (so the returned value is always safe) and the choice
 * is written back afterwards so it persists.
 */
function useResolved<T extends string>(
  key: string,
  fallback: T,
  options: () => readonly T[],
  { allowEmpty = false, nth = 0 }: ResolveOptions = {},
): [T, (value: T) => void] {
  // Re-resolve whenever the data layer's cache changes.
  useDataVersion()

  const available = options()
  const isValid = (v: T) => (allowEmpty && v === ('' as T)) || available.includes(v)

  const [stored, setStored] = usePersistentState<T>(key, fallback, isValid)

  const value: T = isValid(stored)
    ? stored
    : isValid(fallback)
      ? fallback
      : ((available[nth] ?? available[0] ?? fallback) as T)

  useEffect(() => {
    if (value !== stored) setStored(value)
  }, [value, stored, setStored])

  return [value, setStored]
}

/** Driver picker. See `ResolveOptions` for the optional/second-slot cases. */
export function useDriverSelection(key: string, fallback: string, opts?: ResolveOptions) {
  return useResolved(key, fallback, driverIds, opts)
}

export function useGpSelection(key: string, fallback: string) {
  return useResolved(key, fallback, gpIds)
}

export function useSeasonSelection(key: string, fallback: string) {
  return useResolved(key, fallback, () => raceService.getSeasons())
}

export function useSessionSelection(key: string, fallback: SessionType) {
  return useResolved<SessionType>(key, fallback, () => raceService.getSessions())
}

export function useWeatherSelection(key: string, fallback: WeatherCondition) {
  return useResolved<WeatherCondition>(key, fallback, () => raceService.getWeatherConditions())
}

export function useCoachSessionSelection(key: string, fallback: string) {
  return useResolved(key, fallback, () => raceService.getCoachSessions())
}
