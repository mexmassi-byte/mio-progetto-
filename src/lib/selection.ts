/**
 * Persisted analysis selections.
 *
 * Every page picks its cockpit setup (driver, grand prix, season, session,
 * weather) through these hooks, so the choices survive a reload and stay
 * consistent across the app. Values are validated against the data layer:
 * an id that no longer exists falls back to the default instead of breaking
 * the page — important once a real F1 feed starts changing the grid/calendar.
 */
import { usePersistentState } from './usePersistentState'
import { raceService } from '@/services/raceService'
import type { SessionType, WeatherCondition } from '@/domain/models'

const isDriver = (id: string) => raceService.getDrivers().some((d) => d.id === id)
const isGp = (id: string) => raceService.getGrandsPrix().some((g) => g.id === id)
const isSeason = (s: string) => raceService.getSeasons().includes(s)
const isSession = (s: string) => raceService.getSessions().includes(s as SessionType)
const isWeather = (w: string) => raceService.getWeatherConditions().includes(w as WeatherCondition)
const isCoachSession = (s: string) => raceService.getCoachSessions().includes(s)

/** Driver picker. `allowEmpty` supports the optional second-driver slots. */
export function useDriverSelection(key: string, fallback: string, allowEmpty = false) {
  return usePersistentState<string>(key, fallback, (id) =>
    allowEmpty && id === '' ? true : isDriver(id),
  )
}

export function useGpSelection(key: string, fallback: string) {
  return usePersistentState<string>(key, fallback, isGp)
}

export function useSeasonSelection(key: string, fallback: string) {
  return usePersistentState<string>(key, fallback, isSeason)
}

export function useSessionSelection(key: string, fallback: SessionType) {
  return usePersistentState<SessionType>(key, fallback, isSession)
}

export function useWeatherSelection(key: string, fallback: WeatherCondition) {
  return usePersistentState<WeatherCondition>(key, fallback, isWeather)
}

export function useCoachSessionSelection(key: string, fallback: string) {
  return usePersistentState<string>(key, fallback, isCoachSession)
}
