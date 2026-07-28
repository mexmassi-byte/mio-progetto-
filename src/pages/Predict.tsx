import { useMemo, useState } from 'react'
import {
  Sparkles,
  Trophy,
  Flag,
  CloudRain,
  CircleDot,
  Wrench,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Select,
  SegmentedControl,
} from '@/components/ui'
import { Gauge } from '@/components/predict/Gauge'
import { raceService } from '@/services/raceService'
import type { WeatherCondition } from '@/domain/models'
import { toneChipClass as toneChip, probabilityColor as tierColor } from '@/lib/tone'
import { cn } from '@/lib/cn'

const MARK_A = raceService.driverColors.A

function compoundColor(name: string): string {
  const s = name.toLowerCase()
  if (s.includes('soft')) return '#e10600'
  if (s.includes('medium')) return '#fbbf24'
  if (s.includes('hard')) return '#e4e4e7'
  if (s.includes('inter')) return '#34d399'
  if (s.includes('wet') || s.includes('full')) return '#22d3ee'
  return '#a1a1aa'
}

function ProbBar({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr_auto] items-center gap-3 px-5 py-2.5">
      <span className="truncate text-xs text-zinc-400">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-base-700">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${value}%`, backgroundColor: color ?? tierColor(value) }}
        />
      </div>
      <span className="tabular text-xs font-semibold text-zinc-200">{value}%</span>
    </div>
  )
}

export function Predict() {
  const [mode, setMode] = useState<'driver' | 'team'>('driver')
  const [driverId, setDriverId] = useState('ver')
  const [gpId, setGpId] = useState('ita')
  const [season, setSeason] = useState('2025')
  const [weather, setWeather] = useState<WeatherCondition>('Dry')

  const drivers = raceService.getDrivers()
  const teams = useMemo(() => [...new Set(drivers.map((d) => d.team))], [drivers])
  const [teamName, setTeamName] = useState(teams[0])
  const leadOf = (team: string) => drivers.find((d) => d.team === team)!.id

  const subjectId = mode === 'driver' ? driverId : leadOf(teamName)
  const prediction = useMemo(
    () => raceService.getPrediction(subjectId, gpId, season, weather),
    [subjectId, gpId, season, weather],
  )
  const gp = raceService.getGrandsPrix().find((g) => g.id === gpId)!
  const p = prediction.probabilities
  const compounds = prediction.tyreStrategy.split('→').map((s) => s.trim())

  const gauges = [
    { label: 'Vittoria', value: p.win },
    { label: 'Podio', value: p.podium },
    { label: 'Top 10', value: p.top10 },
    { label: 'Pole', value: p.pole },
    { label: 'Giro veloce', value: p.fastestLap },
    { label: 'Safety Car', value: p.safetyCar, color: '#fbbf24' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Predict"
        badge="beta"
        description={`Simula un Gran Premio e ottieni una previsione · ${gp.name} · stagione ${season}. Modello segnaposto, nessuna telemetria reale collegata.`}
      />

      {/* Controls */}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SegmentedControl
            label="Soggetto"
            options={['Pilota', 'Team'] as const}
            value={mode === 'driver' ? 'Pilota' : 'Team'}
            onChange={(v) => setMode(v === 'Pilota' ? 'driver' : 'team')}
          />
          {mode === 'driver' ? (
            <Select
              label="Pilota"
              accent={MARK_A}
              options={drivers.map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))}
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
            />
          ) : (
            <Select
              label="Team"
              options={teams.map((t) => ({ value: t, label: t }))}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          )}
          <Select
            label="Gran Premio"
            options={raceService
              .getGrandsPrix()
              .map((g) => ({ value: g.id, label: `${g.name} — ${g.circuit}` }))}
            value={gpId}
            onChange={(e) => setGpId(e.target.value)}
          />
          <Select
            label="Stagione"
            options={raceService.getSeasons().map((s) => ({ value: s, label: s }))}
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          />
          <SegmentedControl
            label="Meteo"
            options={raceService.getWeatherConditions()}
            value={weather}
            onChange={setWeather}
          />
        </div>
      </Card>

      {/* Subject strip */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: MARK_A }}
            >
              {prediction.driver.code}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                {mode === 'team' ? teamName : prediction.driver.name}
              </p>
              <p className="text-xs text-zinc-500">
                {mode === 'team' ? `Vettura di punta · ${prediction.driver.name}` : prediction.driver.team}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="tabular text-2xl font-bold text-white">P{prediction.expectedPosition}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">posizione attesa</p>
            </div>
            <div className="text-center">
              <p className="tabular text-2xl font-bold text-white">{prediction.pitStops}</p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">pit stop stimati</p>
            </div>
            <Badge tone={weather === 'Wet' ? 'purple' : weather === 'Mixed' ? 'amber' : 'cyan'}>
              <CloudRain className="h-3 w-3" />
              {weather}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Gauges */}
      <Card className="p-6">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {gauges.map((g) => (
            <Gauge key={g.label} label={g.label} value={g.value} color={g.color} />
          ))}
        </div>
      </Card>

      {/* Bars + strategy + AI summary */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Probabilità" subtitle="Esiti simulati" action={<Badge tone="cyan">demo</Badge>} />
            <CardBody className="px-0 py-1">
              <div className="divide-y divide-line">
                <ProbBar label="Vittoria" value={p.win} />
                <ProbBar label="Podio" value={p.podium} />
                <ProbBar label="Top 10" value={p.top10} />
                <ProbBar label="Pole Position" value={p.pole} />
                <ProbBar label="Giro veloce" value={p.fastestLap} />
                <ProbBar label="Safety Car" value={p.safetyCar} color="#fbbf24" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Strategia gomme" subtitle="Piano consigliato" />
            <CardBody>
              <div className="flex flex-wrap items-center gap-2">
                {compounds.map((c, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="text-zinc-600">→</span>}
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-base-800 px-2.5 py-1 text-xs font-medium text-zinc-200"
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: compoundColor(c) }} />
                      {c}
                    </span>
                  </span>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-base-900 px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    <Wrench className="h-3 w-3" /> Pit stop
                  </div>
                  <p className="tabular mt-1 text-lg font-semibold text-zinc-100">{prediction.pitStops}</p>
                </div>
                <div className="rounded-lg border border-line bg-base-900 px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    <CircleDot className="h-3 w-3" /> Safety Car
                  </div>
                  <p className="tabular mt-1 text-lg font-semibold text-signal-amber">{p.safetyCar}%</p>
                </div>
                <div className="rounded-lg border border-line bg-base-900 px-4 py-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    <Flag className="h-3 w-3" /> Griglia
                  </div>
                  <p className="tabular mt-1 text-lg font-semibold text-zinc-100">P{prediction.expectedPosition}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* AI Prediction Summary */}
        <Card>
          <CardHeader
            title="AI Prediction Summary"
            subtitle="Analisi tecnica della simulazione"
            action={<Badge tone="purple">beta</Badge>}
          />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
                <Trophy className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {mode === 'team' ? teamName : prediction.driver.name}
                </p>
                <p className="text-xs text-zinc-500">{gp.name} · {weather}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-zinc-300">{prediction.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {prediction.factors.map((f) => (
                <span
                  key={f.label}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border bg-base-800 px-2 py-1',
                    toneChip[f.tone],
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">{f.label}</span>
                  <span className="tabular text-xs font-semibold">{f.value}</span>
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
