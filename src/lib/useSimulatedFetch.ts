import { useEffect, useState } from 'react'

/**
 * Simulates a short telemetry "fetch" so charts can show an elegant loading
 * state whenever the selection changes. Purely cosmetic — when a real data
 * source is wired up, this becomes the actual request's pending state.
 */
export function useSimulatedFetch(deps: unknown[], ms = 320): boolean {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const t = window.setTimeout(() => setLoading(false), ms)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return loading
}
