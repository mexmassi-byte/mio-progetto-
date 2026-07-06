import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Rewind,
  Play,
  Pause,
  RotateCcw,
  Flag,
  Gauge,
  MapPin,
  Timer,
  CircleDot,
  Radio,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Select,
} from '@/components/ui'
import { CircuitMap } from '@/components/replay/CircuitMap'
import {
  DRIVERS,
  GRANDS_PRIX,
  SESSIONS,
  DRIVER_COLORS,
  generateDriverData,
  type SessionType,
} from '@/data/comparison'
import {
  getTrack,
  sampleFrame,
  SPEED_OPTIONS,
  type PlaybackSpeed,
  type DriverFrame,
} from '@/data/replay'
import { cn } from '@/lib/cn'

const MARK_A = DRIVER_COLORS.A
const MARK_B = DRIVER_COLORS.B
const COLORS = [MARK_A, MARK_B]
const SECONDS_PER_LAP = 0.9 // wall-clock seconds per lap at 1× speed

function fmtGap(sec: number, isLeader: boolean): string {
  if (isLeader) return 'Leader'
  return `+${sec.toFixed(2)}s`
}

// --- Live stats panel -------------------------------------------------------

function StatRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Flag
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="flex items-center gap-2 text-xs text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span
        className="tabular text-sm font-semibold tabular-nums transition-colors"
        style={{ color: color ?? '#e4e4e7' }}
      >
        {value}
      </span>
    </div>
  )
}

function DriverStatsCard({ frame, color }: { frame: DriverFrame; color: string }) {
  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center gap-3 border-b border-line px-4 py-3"
        style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {frame.data.driver.code}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {frame.data.driver.name}
          </p>
          <p className="truncate text-[11px] text-zinc-600">{frame.data.driver.team}</p>
        </div>
      </div>
      <div className="divide-y divide-line">
        <StatRow icon={Flag} label="Lap corrente" value={`${frame.currentLap} / ${frame.totalLaps}`} />
        <StatRow
          icon={Timer}
          label="Gap"
          value={fmtGap(frame.gapToLeader, frame.isLeader)}
          color={frame.isLeader ? '#34d399' : undefined}
        />
        <StatRow icon={MapPin} label="Posizione" value={`P${frame.position}`} />
        <StatRow icon={Gauge} label="Velocità" value={`${frame.speed} km/h`} color={color} />
        <StatRow icon={Radio} label="Settore attuale" value={`S${frame.sector}`} />
        <StatRow
          icon={CircleDot}
          label="Pneumatici"
          value={`${frame.tyreCompound} · ${frame.tyreAge}L`}
        />
      </div>
    </Card>
  )
}

// --- Page -------------------------------------------------------------------

export function RaceReplay() {
  const [gpId, setGpId] = useState('mon')
  const [session, setSession] = useState<SessionType>('Race')
  const [driver1Id, setDriver1Id] = useState('ver')
  const [driver2Id, setDriver2Id] = useState('nor')

  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)

  // Refs keep the rAF loop stable without re-subscribing on every change.
  const playingRef = useRef(playing)
  const speedRef = useRef<number>(speed)
  const totalLapsRef = useRef(78)
  useEffect(() => void (playingRef.current = playing), [playing])
  useEffect(() => void (speedRef.current = speed), [speed])

  const gp = GRANDS_PRIX.find((g) => g.id === gpId)!
  const trackIndex = GRANDS_PRIX.findIndex((g) => g.id === gpId)
  const trackD = getTrack(trackIndex)
  useEffect(() => void (totalLapsRef.current = gp.laps), [gp])

  const selectedIds = useMemo(
    () => [driver1Id, ...(driver2Id ? [driver2Id] : [])],
    [driver1Id, driver2Id],
  )
  const dataList = useMemo(
    () => selectedIds.map((id) => generateDriverData(id, gpId, session)),
    [selectedIds, gpId, session],
  )
  const frame = useMemo(() => sampleFrame(dataList, gp, t), [dataList, gp, t])

  // Playback loop.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (playingRef.current) {
        setT((prev) => {
          const nx = prev + (dt * speedRef.current) / (totalLapsRef.current * SECONDS_PER_LAP)
          if (nx >= 1) {
            playingRef.current = false
            setPlaying(false)
            return 1
          }
          return nx
        })
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const finished = t >= 1
  const togglePlay = () => {
    if (finished) {
      setT(0)
      setPlaying(true)
    } else {
      setPlaying((p) => !p)
    }
  }
  const reset = () => {
    playingRef.current = false
    setPlaying(false)
    setT(0)
  }

  const currentLap = Math.min(gp.laps, Math.floor(t * gp.laps) + 1)

  // Driver option lists with the same-driver guard.
  const d1Options = DRIVERS.map((d) => ({
    value: d.id,
    label: `${d.code} · ${d.name}`,
    disabled: d.id === driver2Id,
  }))
  const d2Options = [
    { value: '', label: '— nessuno —' },
    ...DRIVERS.map((d) => ({
      value: d.id,
      label: `${d.code} · ${d.name}`,
      disabled: d.id === driver1Id,
    })),
  ]
  const gpOptions = GRANDS_PRIX.map((g) => ({ value: g.id, label: `${g.name} — ${g.circuit}` }))

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Rewind}
        title="Race Replay"
        badge="anteprima"
        description={`Rivivi la gara · ${gp.name} · ${session}. Simulazione con dati segnaposto, nessuna telemetria reale collegata.`}
      />

      {/* Controls */}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Select label="Gran Premio" options={gpOptions} value={gpId} onChange={(e) => setGpId(e.target.value)} />
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
                    session === s ? 'bg-base-700 text-white' : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Select
            label="Pilota 1"
            accent={MARK_A}
            options={d1Options}
            value={driver1Id}
            onChange={(e) => e.target.value !== driver2Id && setDriver1Id(e.target.value)}
          />
          <Select
            label="Pilota 2 (opzionale)"
            accent={driver2Id ? MARK_B : undefined}
            options={d2Options}
            value={driver2Id}
            onChange={(e) => e.target.value !== driver1Id && setDriver2Id(e.target.value)}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Map + playback */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Circuito"
              subtitle={`${gp.circuit} · vista in pianta`}
              action={
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-[11px] uppercase tracking-wider',
                    playing ? 'text-signal-green' : 'text-zinc-600',
                  )}
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      playing ? 'bg-signal-green animate-pulse' : 'bg-zinc-600',
                    )}
                  />
                  {finished ? 'Fine' : playing ? 'Live' : 'In pausa'}
                </span>
              }
            />
            <CardBody>
              <CircuitMap trackD={trackD} frames={frame.frames} colors={COLORS} />
            </CardBody>
          </Card>

          {/* Playback controls + timeline */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={reset}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-zinc-300 transition-colors hover:bg-base-800 hover:text-white"
                  aria-label="Reset"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={togglePlay}
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-white shadow-glow transition-colors hover:bg-accent-soft"
                  aria-label={playing ? 'Pausa' : 'Play'}
                >
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
              </div>

              {/* Speed */}
              <div className="flex items-center gap-1 rounded-lg border border-line bg-base-900 p-0.5">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={cn(
                      'rounded-md px-2.5 py-1.5 text-xs font-medium tabular transition-colors',
                      speed === s ? 'bg-base-700 text-white' : 'text-zinc-500 hover:text-zinc-300',
                    )}
                  >
                    {s}×
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2 text-sm">
                <Flag className="h-4 w-4 text-zinc-500" />
                <span className="tabular font-semibold text-zinc-100">
                  Lap {currentLap}
                </span>
                <span className="tabular text-zinc-600">/ {gp.laps}</span>
              </div>
            </div>

            {/* Timeline scrubber */}
            <div className="mt-5">
              <div className="relative h-2.5">
                <div className="absolute inset-0 rounded-full bg-base-700" />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent-muted to-accent"
                  style={{ width: `${t * 100}%` }}
                />
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-base-950 bg-white shadow"
                  style={{ left: `${t * 100}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={Math.round(t * 1000)}
                  onChange={(e) => setT(Number(e.target.value) / 1000)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Timeline gara"
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] tabular text-zinc-600">
                <span>Lap 1</span>
                <span>{Math.round(gp.laps * 0.25)}</span>
                <span>{Math.round(gp.laps * 0.5)}</span>
                <span>{Math.round(gp.laps * 0.75)}</span>
                <span>{gp.laps}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Live stats side panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-zinc-200">Telemetria live</h3>
            <Badge tone="cyan">demo</Badge>
          </div>
          {frame.frames.map((f, i) => (
            <DriverStatsCard key={f.data.driver.id} frame={f} color={COLORS[i]} />
          ))}
        </div>
      </div>
    </div>
  )
}
