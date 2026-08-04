import { useEffect, useState } from 'react'
import { probabilityColor } from '@/lib/tone'

interface GaugeProps {
  value: number // 0–100
  label: string
  /** Override the auto tier color. */
  color?: string
  size?: number
}

const SIZE = 116
const STROKE = 9
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R

/**
 * Animated circular gauge (activity-ring style). The progress arc sweeps in
 * from the top on mount; color reflects likelihood unless overridden.
 */
export function Gauge({ value, label, color, size = SIZE }: GaugeProps) {
  // Starts empty and sweeps in on mount; afterwards the arc eases directly
  // from the old value to the new one, so changing a selection reads as the
  // needle moving rather than a silent swap.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value])

  const stroke = color ?? probabilityColor(value)
  const offset = C * (1 - Math.max(0, Math.min(100, shown)) / 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#20202a" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            style={{
              transition:
                'stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1), stroke 0.4s ease-out',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-xl font-bold text-zinc-100">{Math.round(value)}</span>
          <span className="text-[10px] text-zinc-600">%</span>
        </div>
      </div>
      <span className="text-center text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
    </div>
  )
}
