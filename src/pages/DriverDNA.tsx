import { useEffect, useMemo, useState } from 'react'
import { Dna, Sparkles, Trophy, Target, TrendingUp } from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Select,
} from '@/components/ui'
import { RadarChart } from '@/components/dna/RadarChart'
import { raceService } from '@/services/raceService'
import { cn } from '@/lib/cn'

const MARK_A = raceService.driverColors.A
const MARK_B = raceService.driverColors.B

// Short labels for the radar axes (full labels are used in the bars).
const SHORT: Record<string, string> = {
  qualifying: 'Quali',
  racePace: 'Race',
  tyres: 'Tyres',
  overtaking: 'Overtake',
  defending: 'Defense',
  aggression: 'Aggr',
  consistency: 'Consist',
  wet: 'Wet',
  starts: 'Starts',
  pressure: 'Pressure',
}

interface Tier {
  label: string
  color: string
  text: string
}
function tierOf(value: number): Tier {
  if (value >= 88) return { label: 'Elite', color: '#34d399', text: 'text-signal-green' }
  if (value >= 78) return { label: 'Strong', color: '#22d3ee', text: 'text-signal' }
  if (value >= 66) return { label: 'Solid', color: '#fbbf24', text: 'text-signal-amber' }
  return { label: 'Developing', color: '#a1a1aa', text: 'text-zinc-400' }
}

// --- animated attribute comparison bar --------------------------------------

function AttributeBar({
  label,
  a,
  b,
  animated,
}: {
  label: string
  a: number
  b?: number
  animated: boolean
}) {
  const tier = tierOf(a)
  const barColorA = b !== undefined ? MARK_A : tier.color
  return (
    <div className="grid grid-cols-[130px_1fr_auto] items-center gap-3 px-5 py-2.5">
      <span className="truncate text-xs text-zinc-400">{label}</span>
      <div className="space-y-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-base-700">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${animated ? a : 0}%`, backgroundColor: barColorA }}
          />
        </div>
        {b !== undefined && (
          <div className="h-1.5 overflow-hidden rounded-full bg-base-700">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${animated ? b : 0}%`, backgroundColor: MARK_B }}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={cn('tabular text-xs font-semibold', b === undefined ? tier.text : '')} style={b !== undefined ? { color: MARK_A } : undefined}>
          {a}
        </span>
        {b !== undefined && (
          <span className="tabular text-xs font-semibold" style={{ color: MARK_B }}>
            {b}
          </span>
        )}
      </div>
    </div>
  )
}

// --- mini stat card ---------------------------------------------------------

function MiniCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Trophy
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 truncate text-lg font-semibold" style={{ color: accent ?? '#f4f4f5' }}>
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-zinc-600">{sub}</p>}
    </Card>
  )
}

// --- page -------------------------------------------------------------------

export function DriverDNA() {
  const [driverAId, setDriverAId] = useState('ver')
  const [driverBId, setDriverBId] = useState('')
  const [season, setSeason] = useState('2025')

  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const dnaA = useMemo(
    () => raceService.getDriverDNA(driverAId, season),
    [driverAId, season],
  )
  const dnaB = useMemo(
    () => (driverBId ? raceService.getDriverDNA(driverBId, season) : null),
    [driverBId, season],
  )
  const analysis = useMemo(() => raceService.analyzeDNA(dnaA), [dnaA])

  const axes = dnaA.attributes.map((attr) => SHORT[attr.key] ?? attr.label)
  const series = [
    { label: dnaA.driver.code, color: MARK_A, values: dnaA.attributes.map((a) => a.value) },
    ...(dnaB
      ? [{ label: dnaB.driver.code, color: MARK_B, values: dnaB.attributes.map((a) => a.value) }]
      : []),
  ]

  const driverOptions = (otherId: string, withNone = false) => [
    ...(withNone ? [{ value: '', label: '— nessuno —' }] : []),
    ...raceService.getDrivers().map((d) => ({
      value: d.id,
      label: `${d.code} · ${d.name}`,
      disabled: d.id === otherId,
    })),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Dna}
        title="Driver DNA"
        badge="anteprima"
        description={`Profilo tecnico dello stile di guida · stagione ${season}. Dati segnaposto coerenti, nessuna telemetria reale collegata.`}
      />

      {/* Controls */}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Select
            label="Pilota"
            accent={MARK_A}
            options={driverOptions(driverBId)}
            value={driverAId}
            onChange={(e) => e.target.value !== driverBId && setDriverAId(e.target.value)}
          />
          <Select
            label="Stagione"
            options={raceService.getSeasons().map((s) => ({ value: s, label: s }))}
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          />
          <Select
            label="Confronta con (opzionale)"
            accent={driverBId ? MARK_B : undefined}
            options={driverOptions(driverAId, true)}
            value={driverBId}
            onChange={(e) => e.target.value !== driverAId && setDriverBId(e.target.value)}
          />
        </div>
      </Card>

      {/* Summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniCard
          icon={TrendingUp}
          label="DNA index"
          value={`${dnaA.overall}`}
          sub={`${dnaA.driver.name} · ${dnaA.driver.team}`}
          accent={MARK_A}
        />
        <MiniCard icon={Sparkles} label="Archetipo" value={analysis.archetype} />
        <MiniCard
          icon={Trophy}
          label="Punto di forza"
          value={analysis.strengths[0].label}
          sub={`${analysis.strengths[0].value} / 100`}
          accent="#34d399"
        />
        <MiniCard
          icon={Target}
          label="Area di lavoro"
          value={analysis.weaknesses[0].label}
          sub={`${analysis.weaknesses[0].value} / 100`}
          accent="#fbbf24"
        />
      </div>

      {/* Radar + AI analysis */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Driver DNA"
            subtitle="Profilo su 10 attributi"
            action={
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: MARK_A }} />
                  {dnaA.driver.code}
                </span>
                {dnaB && (
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: MARK_B }} />
                    {dnaB.driver.code}
                  </span>
                )}
              </div>
            }
          />
          <CardBody>
            <RadarChart axes={axes} series={series} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="AI Driver Analysis"
            subtitle="Lettura dello stile di guida"
            action={<Badge tone="purple">beta</Badge>}
          />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
                <Dna className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">{analysis.archetype}</p>
                <p className="text-xs text-zinc-500">
                  {dnaA.driver.name} · DNA {dnaA.overall}
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-zinc-300">{analysis.summary}</p>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Punti di forza
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.strengths.map((s) => (
                  <span
                    key={s.key}
                    className="inline-flex items-center gap-1.5 rounded-md border border-signal-green/30 bg-base-800 px-2 py-1 text-xs text-signal-green"
                  >
                    {s.label}
                    <span className="tabular font-semibold">{s.value}</span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Aree di lavoro
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.weaknesses.map((w) => (
                  <span
                    key={w.key}
                    className="inline-flex items-center gap-1.5 rounded-md border border-signal-amber/30 bg-base-800 px-2 py-1 text-xs text-signal-amber"
                  >
                    {w.label}
                    <span className="tabular font-semibold">{w.value}</span>
                  </span>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Attribute bars */}
      <Card>
        <CardHeader
          title="Attributi"
          subtitle={dnaB ? 'Confronto per attributo' : 'Indicatori per attributo'}
          action={<Badge tone="cyan">demo</Badge>}
        />
        <CardBody className="px-0 py-1">
          <div className="divide-y divide-line">
            {dnaA.attributes.map((attr, i) => (
              <AttributeBar
                key={attr.key}
                label={attr.label}
                a={attr.value}
                b={dnaB?.attributes[i].value}
                animated={animated}
              />
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
