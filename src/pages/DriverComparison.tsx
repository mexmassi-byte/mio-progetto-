import { useMemo, useState } from 'react'
import {
  Users,
  ArrowLeftRight,
  Timer,
  Gauge,
  CircleDot,
  Flag,
  Trophy,
  Minus,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  Select,
} from '@/components/ui'
import { LapTimeChart } from '@/components/comparison/LapTimeChart'
import {
  DRIVERS,
  GRANDS_PRIX,
  SESSIONS,
  DRIVER_COLORS,
  generateDriverData,
  buildComparison,
  type SessionType,
  type DriverData,
  type MetricRow,
  type Winner,
} from '@/data/comparison'
import { cn } from '@/lib/cn'

const MARK_A = DRIVER_COLORS.A
const MARK_B = DRIVER_COLORS.B

const winnerText: Record<Winner, string> = {
  A: 'text-accent-soft',
  B: 'text-signal',
  tie: 'text-zinc-400',
}

// --- Driver identity column -------------------------------------------------

function DriverColumn({
  data,
  side,
}: {
  data: DriverData
  side: 'A' | 'B'
}) {
  const color = side === 'A' ? MARK_A : MARK_B
  const { driver } = data
  const stats = [
    { icon: Flag, label: 'Position', value: `P${data.position}` },
    { icon: Timer, label: 'Best Lap', value: formatLap(data.lapTime) },
    { icon: Gauge, label: 'Top Speed', value: `${data.topSpeed} km/h` },
    {
      icon: CircleDot,
      label: 'Tyre',
      value: `${data.tyreCompound} · ${data.tyreAge}L`,
    },
  ]
  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center gap-3 border-b border-line px-5 py-4"
        style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}
      >
        <div
          className="flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {driver.code}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {driver.name}
          </p>
          <p className="truncate text-xs text-zinc-500">{driver.team}</p>
        </div>
        <Badge tone={side === 'A' ? 'accent' : 'cyan'}>Driver {side}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-px bg-line">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-base-900 px-5 py-3">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                <Icon className="h-3 w-3" />
                {s.label}
              </div>
              <p className="tabular mt-1 text-lg font-semibold text-zinc-100">
                {s.value}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function formatLap(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = (sec - m * 60).toFixed(3).padStart(6, '0')
  return `${m}:${s}`
}

// --- Head-to-head metric row ------------------------------------------------

function MetricRowView({ row }: { row: MetricRow }) {
  return (
    <div className="px-5 py-3.5">
      <div className="grid grid-cols-[1fr_minmax(96px,1.4fr)_1fr] items-center gap-3">
        <span
          className={cn(
            'tabular text-right text-sm font-semibold',
            row.winner === 'A' ? winnerText.A : 'text-zinc-500',
          )}
        >
          {row.displayA}
        </span>

        <div className="flex flex-col items-center gap-1.5">
          <span className="text-center text-[10px] uppercase tracking-wider text-zinc-500">
            {row.label}
          </span>
          {/* Tug-of-war advantage bar */}
          <div className="flex h-1.5 w-full items-center gap-[2px]">
            <div className="flex h-full flex-1 justify-end overflow-hidden rounded-l-full bg-base-700">
              <div
                className="h-full rounded-l-full"
                style={{ width: `${row.shareA * 100}%`, backgroundColor: MARK_A }}
              />
            </div>
            <div className="flex h-full flex-1 overflow-hidden rounded-r-full bg-base-700">
              <div
                className="h-full rounded-r-full"
                style={{ width: `${(1 - row.shareA) * 100}%`, backgroundColor: MARK_B }}
              />
            </div>
          </div>
        </div>

        <span
          className={cn(
            'tabular text-left text-sm font-semibold',
            row.winner === 'B' ? winnerText.B : 'text-zinc-500',
          )}
        >
          {row.displayB}
        </span>
      </div>
      {row.hint && (
        <p className="mt-1 text-center text-[10px] text-zinc-600">{row.hint}</p>
      )}
    </div>
  )
}

// --- Sector analysis (diverging delta bars) ---------------------------------

function SectorAnalysis({
  a,
  b,
  codeA,
  codeB,
}: {
  a: DriverData
  b: DriverData
  codeA: string
  codeB: string
}) {
  const sectors = [
    { label: 'Sector 1', delta: a.s1 - b.s1 },
    { label: 'Sector 2', delta: a.s2 - b.s2 },
    { label: 'Sector 3', delta: a.s3 - b.s3 },
  ]
  const maxAbs = Math.max(...sectors.map((s) => Math.abs(s.delta)), 0.05)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
        <span style={{ color: MARK_A }}>◄ {codeA} faster</span>
        <span style={{ color: MARK_B }}>{codeB} faster ►</span>
      </div>
      {sectors.map((s) => {
        const aFaster = s.delta < 0
        const pct = (Math.abs(s.delta) / maxAbs) * 50 // half-width max
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-zinc-400">{s.label}</span>
              <span className="tabular text-zinc-500">
                {s.delta > 0 ? '+' : ''}
                {s.delta.toFixed(3)}s
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-base-700">
              <div className="absolute left-1/2 top-0 h-full w-px bg-base-600" />
              <div
                className="absolute top-0 h-full rounded-full"
                style={{
                  backgroundColor: aFaster ? MARK_A : MARK_B,
                  width: `${pct}%`,
                  ...(aFaster
                    ? { right: '50%' }
                    : { left: '50%' }),
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- Summary ----------------------------------------------------------------

function SummarySection({
  rows,
  scoreA,
  scoreB,
  a,
  b,
}: {
  rows: MetricRow[]
  scoreA: number
  scoreB: number
  a: DriverData
  b: DriverData
}) {
  const leader =
    scoreA === scoreB ? null : scoreA > scoreB ? a : b
  const total = scoreA + scoreB || 1

  return (
    <Card>
      <CardHeader
        title="Summary"
        subtitle="Vincitore automatico per categoria"
        action={<Badge tone="cyan">demo</Badge>}
      />
      <CardBody className="space-y-5">
        {/* Headline */}
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-base-850 p-4 text-center">
          {leader ? (
            <>
              <Trophy className="h-6 w-6 text-signal-amber" />
              <p className="text-sm text-zinc-400">
                In vantaggio in questa sessione
              </p>
              <p className="text-lg font-semibold text-white">
                {leader.driver.name}
              </p>
            </>
          ) : (
            <>
              <Minus className="h-6 w-6 text-zinc-500" />
              <p className="text-lg font-semibold text-white">Parità</p>
            </>
          )}
          <div className="flex items-center gap-4">
            <span className="tabular text-2xl font-bold" style={{ color: MARK_A }}>
              {scoreA}
            </span>
            <span className="text-xs uppercase tracking-wider text-zinc-600">
              categorie
            </span>
            <span className="tabular text-2xl font-bold" style={{ color: MARK_B }}>
              {scoreB}
            </span>
          </div>
          {/* Score bar */}
          <div className="flex h-2 w-full max-w-xs overflow-hidden rounded-full bg-base-700">
            <div style={{ width: `${(scoreA / total) * 100}%`, backgroundColor: MARK_A }} />
            <div style={{ width: `${(scoreB / total) * 100}%`, backgroundColor: MARK_B }} />
          </div>
        </div>

        {/* Per-category winner chips */}
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {rows.map((r) => {
            const win = r.winner
            const code =
              win === 'A' ? a.driver.code : win === 'B' ? b.driver.code : '—'
            const color = win === 'A' ? MARK_A : win === 'B' ? MARK_B : '#3f3f46'
            return (
              <li
                key={r.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-line bg-base-900 px-3 py-2"
              >
                <span className="text-xs text-zinc-400">{r.label}</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {code}
                </span>
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}

// --- Page -------------------------------------------------------------------

export function DriverComparison() {
  const [driverAId, setDriverAId] = useState('ver')
  const [driverBId, setDriverBId] = useState('nor')
  const [gpId, setGpId] = useState('ita')
  const [session, setSession] = useState<SessionType>('Qualifying')

  const dataA = useMemo(
    () => generateDriverData(driverAId, gpId, session),
    [driverAId, gpId, session],
  )
  const dataB = useMemo(
    () => generateDriverData(driverBId, gpId, session),
    [driverBId, gpId, session],
  )
  const comparison = useMemo(() => buildComparison(dataA, dataB), [dataA, dataB])

  const gp = GRANDS_PRIX.find((g) => g.id === gpId)!

  const swap = () => {
    setDriverAId(driverBId)
    setDriverBId(driverAId)
  }

  // Build the driver options, disabling whoever is already picked in the
  // other menu so the same driver can't be selected on both sides.
  const driverOptionsExcept = (otherId: string) =>
    DRIVERS.map((d) => ({
      value: d.id,
      label: `${d.code} · ${d.name}`,
      disabled: d.id === otherId,
    }))
  const gpOptions = GRANDS_PRIX.map((g) => ({ value: g.id, label: `${g.name} — ${g.circuit}` }))

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Driver Comparison"
        badge="anteprima"
        description={`Confronto testa a testa · ${gp.name} · ${session}. Dati segnaposto, nessuna telemetria reale collegata.`}
        actions={
          <Button size="sm" variant="outline" onClick={swap}>
            <ArrowLeftRight className="h-4 w-4" />
            Scambia
          </Button>
        }
      />

      {/* Controls */}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Select
            label="Driver A"
            accent={MARK_A}
            options={driverOptionsExcept(driverBId)}
            value={driverAId}
            // Ignore a pick that equals the other driver (controlled select
            // snaps the value back), so the two can never match.
            onChange={(e) => e.target.value !== driverBId && setDriverAId(e.target.value)}
          />
          <Select
            label="Driver B"
            accent={MARK_B}
            options={driverOptionsExcept(driverAId)}
            value={driverBId}
            onChange={(e) => e.target.value !== driverAId && setDriverBId(e.target.value)}
          />
          <Select
            label="Gran Premio"
            options={gpOptions}
            value={gpId}
            onChange={(e) => setGpId(e.target.value)}
          />
          <div>
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Sessione
            </span>
            <div className="flex rounded-lg border border-line bg-base-900 p-0.5">
              {SESSIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSession(s)}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                    session === s
                      ? 'bg-base-700 text-white'
                      : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Two driver columns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DriverColumn data={dataA} side="A" />
        <DriverColumn data={dataB} side="B" />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Lap Time" subtitle="Andamento sul giro" />
          <CardBody>
            <LapTimeChart
              seriesA={dataA.lapSeries}
              seriesB={dataB.lapSeries}
              codeA={dataA.driver.code}
              codeB={dataB.driver.code}
              colorA={MARK_A}
              colorB={MARK_B}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sector Analysis" subtitle="Delta per settore" />
          <CardBody>
            <SectorAnalysis
              a={dataA}
              b={dataB}
              codeA={dataA.driver.code}
              codeB={dataB.driver.code}
            />
          </CardBody>
        </Card>
      </div>

      {/* Head-to-head metrics */}
      <Card>
        <CardHeader
          title="Head to Head"
          subtitle="Tutte le categorie · vincitore evidenziato"
          action={
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: MARK_A }} />
                {dataA.driver.code}
              </span>
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: MARK_B }} />
                {dataB.driver.code}
              </span>
            </div>
          }
        />
        <CardBody className="px-0 py-0">
          <div className="divide-y divide-line">
            {comparison.rows.map((row) => (
              <MetricRowView key={row.key} row={row} />
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Summary */}
      <SummarySection
        rows={comparison.rows}
        scoreA={comparison.scoreA}
        scoreB={comparison.scoreB}
        a={dataA}
        b={dataB}
      />
    </div>
  )
}
