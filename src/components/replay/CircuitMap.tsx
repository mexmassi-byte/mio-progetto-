import { useLayoutEffect, useRef, useState } from 'react'
import type { ReplayFrame } from '@/domain/models'

interface CircuitMapProps {
  trackD: string
  frames: ReplayFrame[]
  colors: string[]
  /** Sector boundaries as lap fractions (from the data service). */
  sectorBounds: readonly number[]
}

/**
 * Placeholder circuit map. Draws a stylised track and moves each selected
 * car along the path via SVG getPointAtLength(), so it already animates the
 * cars' progress. A real feed would swap the path geometry and feed true
 * positions — the moving-marker mechanism stays the same.
 */
export function CircuitMap({ trackD, frames, colors, sectorBounds }: CircuitMapProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const [len, setLen] = useState(0)

  useLayoutEffect(() => {
    if (pathRef.current) setLen(pathRef.current.getTotalLength())
  }, [trackD])

  const pointAt = (frac: number) => {
    const p = pathRef.current
    if (!p || !len) return null
    const f = ((frac % 1) + 1) % 1
    const q = p.getPointAtLength(f * len)
    return { x: q.x, y: q.y }
  }

  const start = pointAt(0)

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-base-950">
      {/* faint grid backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:24px_24px] opacity-60" />
      <svg viewBox="0 0 420 240" className="relative w-full" role="img" aria-label="Circuit map">
        {/* track base + racing line */}
        <path
          ref={pathRef}
          d={trackD}
          fill="none"
          stroke="#1e1e26"
          strokeWidth={16}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={trackD}
          fill="none"
          stroke="#2a2a34"
          strokeWidth={2}
          strokeDasharray="1 7"
          strokeLinecap="round"
        />

        {/* sector boundary ticks */}
        {sectorBounds.map((b, i) => {
          const p = pointAt(b)
          return p ? (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill="#52525b" />
          ) : null
        })}

        {/* start / finish */}
        {start && (
          <g>
            <circle cx={start.x} cy={start.y} r={4} fill="none" stroke="#a1a1aa" strokeWidth={2} />
            <text x={start.x + 8} y={start.y - 6} fontSize={9} fill="#71717a">
              S/F
            </text>
          </g>
        )}

        {/* cars */}
        {frames.map((f, i) => {
          const p = pointAt(f.lapFrac)
          if (!p) return null
          const color = colors[i] ?? '#e10600'
          return (
            // Keyed by slot: two frames can share a driver while a session
            // is still loading placeholder stats.
            <g key={`${f.data.driver.id}-${i}`} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
              <circle cx={p.x} cy={p.y} r={7} fill={color} stroke="#0a0a0c" strokeWidth={2} />
              <text
                x={p.x}
                y={p.y + 3}
                textAnchor="middle"
                fontSize={7}
                fontWeight={700}
                fill="#ffffff"
              >
                {f.data.driver.code}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
