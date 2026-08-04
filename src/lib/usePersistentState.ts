import { useCallback, useEffect, useState } from 'react'

const PREFIX = 'tpv:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* quota or private mode — persistence is best-effort */
  }
}

/**
 * `useState` that survives reloads by mirroring into localStorage.
 *
 * Used for the analysis selections (driver, grand prix, season, weather,
 * session) so reopening the app restores the last cockpit setup instead of
 * resetting to defaults.
 *
 * `validate` guards against stale values: if a persisted id no longer exists
 * (a driver left the grid, a circuit was dropped) the fallback is used.
 */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  validate?: (value: T) => boolean,
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(() => {
    const stored = read(key, fallback)
    if (validate && !validate(stored)) return fallback
    return stored
  })

  useEffect(() => {
    write(key, state)
  }, [key, state])

  const set = useCallback((value: T) => setState(value), [])

  return [state, set]
}

/** Read a persisted value outside React (e.g. to seed another module). */
export function readPersisted<T>(key: string, fallback: T): T {
  return read(key, fallback)
}

/**
 * Write a persisted value outside React. Used by global search to preselect
 * an entity before navigating, so the destination page mounts already set.
 */
export function writePersisted<T>(key: string, value: T): void {
  write(key, value)
}

