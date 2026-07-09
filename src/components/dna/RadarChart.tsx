import { useEffect, useRef, useState } from 'react'

export interface RadarSeries {
  label: string
  color: string
  values: number[]
}

interface RadarChartProps {
  /** Short axis labels, in the same order as each series' values. */
  axes: string[]
  series: RadarSeries[]
  max?: number
}

const VB = 360
const CX = 180
const CY = 168
const R = 116
const LABEL_R = R + 22
const RINGS = [0.25, 0.5, 0.75, 1]

/**
 * Interactive radar/spider chart for the Driver DNA. Supports one or two
 * overlaid series, animates in on mount, and shows a crosshair tooltip for
 * the nearest attribute on hover.
 */
export function RadarChart({ axes, series, max = 100 }: RadarChartProps) {
  const n = axes.length
  const [mounted, setMounted] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const point = (value: number, i: number) => {
    const r = (Math.max(0, Math.min(max, value)) / max) * R
    return [CX + r * Math.cos(angle(i)), CY + r * Math.sin(angle(i))] as const
  }

  const ringPath = (f: number) =>
    axes
      .map((_, i) => {
        const [x, y] = [CX + f * R * Math.cos(angle(i)), CY + f * R * Math.sin(angle(i))]
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ') + ' Z'

  const seriesPath = (values: number[]) =>
    values
      .map((v, i) => {
        const [x, y] = point(v, i)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ') + ' Z'

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * VB - CX
    const y = ((e.clientY - rect.top) / rect.height) * VB - CY
    if (Math.hypot(x, y) < 12) return setHover(null)
    let a = Math.atan2(y, x) + Math.PI / 2
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    setHover(Math.round(a / ((2 * Math.PI) / n)) % n)
  }

  const hoverPos = hover !== null ? point(max * 1.02, hover) : null

  return (
    <div className="relative mx-auto w-full max-w-md">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Driver DNA radar"
      >
        {/* rings */}
        {RINGS.map((f, i) => (
          <path key={i} d={ringPath(f)} fill="none" stroke="#20202a" strokeWidth={1} />
        ))}
        {/* spokes + labels */}
        {axes.map((label, i) => {
          const [sx, sy] = [CX + R * Math.cos(angle(i)), CY + R * Math.sin(angle(i))]
          const [lx, ly] = [CX + LABEL_R * Math.cos(angle(i)), CY + LABEL_R * Math.sin(angle(i))]
          const cos = Math.cos(angle(i))
          const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
          return (
            <g key={label}>
              <line x1={CX} y1={CY} x2={sx} y2={sy} stroke="#20202a" strokeWidth={1} />
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={9}
                fill={hover === i ? '#e4e4e7' : '#71717a'}
                fontWeight={hover === i ? 700 : 400}
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* animated series */}
        <g
          style={{
            transform: mounted ? 'scale(1)' : 'scale(0.2)',
            opacity: mounted ? 1 : 0,
            transformOrigin: `${CX}px ${CY}px`,
            transition: 'transform 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.5s ease-out',
          }}
        >
          {series.map((s) => (
            <path
              key={s.label}
              d={seriesPath(s.values)}
              fill={s.color}
              fillOpacity={0.14}
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ))}
          {series.map((s) =>
            s.values.map((v, i) => {
              const [x, y] = point(v, i)
              return (
                <circle
                  key={`${s.label}-${i}`}
                  cx={x}
                  cy={y}
                  r={hover === i ? 4.5 : 3}
                  fill={s.color}
                  stroke="#0b0b0e"
                  strokeWidth={1.5}
                />
              )
            }),
          )}
        </g>

        {/* hovered spoke highlight */}
        {hover !== null && (
          <line
            x1={CX}
            y1={CY}
            x2={CX + R * Math.cos(angle(hover))}
            y2={CY + R * Math.sin(angle(hover))}
            stroke="#3f3f46"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {/* tooltip */}
      {hover !== null && hoverPos && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-base-800 px-3 py-2 text-xs shadow-panel"
          style={{ left: `${(hoverPos[0] / VB) * 100}%`, top: `${(hoverPos[1] / VB) * 100}%` }}
        >
          <p className="mb-1 font-medium text-zinc-300">{axes[hover]}</p>
          {series.map((s) => (
            <p key={s.label} className="flex items-center gap-2 tabular text-zinc-200">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
              <span className="ml-auto font-semibold">{s.values[hover]}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
