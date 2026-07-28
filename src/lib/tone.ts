import type { MetricTone } from '@/domain/models'

/**
 * Shared tone mappings so every "chip"/indicator across the app (AI Race
 * Engineer, AI Coach, Predict, …) renders identically.
 */

/** Chip border + text classes per tone. */
export const toneChipClass: Record<MetricTone, string> = {
  accent: 'border-accent/30 text-accent-soft',
  cyan: 'border-signal/30 text-signal',
  green: 'border-signal-green/30 text-signal-green',
  amber: 'border-signal-amber/30 text-signal-amber',
  purple: 'border-signal-purple/30 text-signal-purple',
  neutral: 'border-line text-zinc-300',
}

/** Raw hex per tone (for SVG/inline styles). */
export const toneHex: Record<MetricTone, string> = {
  accent: '#e10600',
  cyan: '#22d3ee',
  green: '#34d399',
  amber: '#fbbf24',
  purple: '#a78bfa',
  neutral: '#71717a',
}

/** Heat color for a 0–100 likelihood (probabilities, gauges). */
export function probabilityColor(value: number): string {
  if (value >= 55) return toneHex.green
  if (value >= 30) return toneHex.cyan
  if (value >= 12) return toneHex.amber
  return toneHex.neutral
}
