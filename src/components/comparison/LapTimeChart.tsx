import { useMemo, useState } from 'react'

interface LapTimeChartProps {
  seriesA: number[]
  seriesB: number[]
  codeA: string
  codeB: string
  colorA: string
  colorB: string
}

const W = 680
const H = 260
const PAD = { top: 22, right: 92, bottom: 30, left: 46 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = (sec - m * 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

/**
 * Placeholder lap-time trend: two driver series on a single time axis.
 * Faster (lower) lap times sit higher. Ships with a crosshair tooltip.
 */
export function LapTimeChart({
  seriesA,
  seriesB,
  codeA,
  codeB,
  colorA,
  colorB,
}: LapTimeChartProps) {
  const [hover, setHover] = useState<number | null>(null)

  const { x, y, min, max, pathA, pathB, n } = useMemo(() => {
    const n = Math.max(seriesA.length, seriesB.length)
    const all = [...seriesA, ...seriesB]
    const rawMin = Math.min(...all)
    const rawMax = Math.max(...all)
    const pad = (rawMax - rawMin) * 0.15 || 0.5
    const min = rawMin - pad
    const max = rawMax + pad
    const x = (i: number) => PAD.left + (n === 1 ? 0 : (i / (n - 1)) * plotW)
    const y = (v: number) => PAD.top + ((v - min) / (max - min)) * plotH
    const toPath = (s: number[]) =>
      s.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    return { x, y, min, max, pathA: toPath(seriesA), pathB: toPath(seriesB), n }
  }, [seriesA, seriesB])

  const yTicks = [min, (min + max) / 2, max]
  const hoverX = hover !== null ? x(hover) : 0

  return (
    <div className="relative w-full">
      {/* Legend */}
      <div className="mb-2 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-zinc-400">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorA }} />
          {codeA}
        </span>
        <span className="flex items-center gap-1.5 text-zinc-400">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorB }} />
          {codeB}
        </span>
        <span className="ml-auto text-zinc-600">Lap time · sec</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Lap time trend, ${codeA} vs ${codeB}`}
        onMouseLeave={() => setHover(null)}
      >
        {/* Y grid + labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="#23232c"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#52525b">
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* X labels (every ~4 laps) */}
        {Array.from({ length: n }).map((_, i) =>
          i % 4 === 0 || i === n - 1 ? (
            <text
              key={i}
              x={x(i)}
              y={H - 10}
              textAnchor="middle"
              fontSize={10}
              fill="#52525b"
            >
              {i + 1}
            </text>
          ) : null,
        )}

        {/* Series */}
        <path d={pathB} fill="none" stroke={colorB} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={pathA} fill="none" stroke={colorA} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* End labels */}
        <text x={x(n - 1) + 8} y={y(seriesA[n - 1]) + 3} fontSize={11} fontWeight={600} fill={colorA}>
          {codeA}
        </text>
        <text x={x(n - 1) + 8} y={y(seriesB[n - 1]) + 3} fontSize={11} fontWeight={600} fill={colorB}>
          {codeB}
        </text>

        {/* Crosshair + highlighted points */}
        {hover !== null && (
          <>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="#3f3f46"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={hoverX} cy={y(seriesB[hover])} r={4.5} fill={colorB} stroke="#0a0a0c" strokeWidth={2} />
            <circle cx={hoverX} cy={y(seriesA[hover])} r={4.5} fill={colorA} stroke="#0a0a0c" strokeWidth={2} />
          </>
        )}

        {/* Hover hit-bands */}
        {Array.from({ length: n }).map((_, i) => (
          <rect
            key={i}
            x={x(i) - plotW / (n - 1) / 2}
            y={PAD.top}
            width={plotW / (n - 1)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 -translate-x-1/2 rounded-lg border border-line bg-base-800 px-3 py-2 text-xs shadow-panel"
          style={{ left: `${(hoverX / W) * 100}%` }}
        >
          <p className="mb-1 font-medium text-zinc-400">Lap {hover + 1}</p>
          <p className="flex items-center gap-2 tabular text-zinc-200">
            <span className="h-2 w-2 rounded-full" style={{ background: colorA }} />
            {codeA} <span className="ml-auto font-semibold">{fmt(seriesA[hover])}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-2 tabular text-zinc-200">
            <span className="h-2 w-2 rounded-full" style={{ background: colorB }} />
            {codeB} <span className="ml-auto font-semibold">{fmt(seriesB[hover])}</span>
          </p>
        </div>
      )}
    </div>
  )
}
