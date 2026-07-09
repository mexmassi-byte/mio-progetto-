/**
 * Shared display formatters. Keep all number → string formatting here so the
 * whole app renders laps, gaps and deltas identically.
 */

/** Seconds → `m:ss.mmm` (e.g. 82.396 → "1:22.396"). */
export function formatLapTime(seconds: number, decimals = 3): string {
  const m = Math.floor(seconds / 60)
  const rest = (seconds - m * 60).toFixed(decimals)
  // pad so the seconds part always has two integer digits (e.g. "02.4")
  const pad = decimals > 0 ? 3 + decimals : 2
  return `${m}:${rest.padStart(pad, '0')}`
}

/** Seconds → signed interval (e.g. 0.28 → "+0.28s", -1.4 → "-1.40s"). */
export function formatGap(seconds: number, decimals = 2): string {
  return `${seconds > 0 ? '+' : ''}${seconds.toFixed(decimals)}s`
}
