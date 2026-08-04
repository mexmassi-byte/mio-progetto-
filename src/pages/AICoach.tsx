import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GraduationCap,
  Send,
  Sparkles,
  User,
  ShieldCheck,
  Crosshair,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Select,
} from '@/components/ui'
import { LapTimeChart } from '@/components/comparison/LapTimeChart'
import { ChartSkeleton } from '@/components/comparison/ChartSkeleton'
import { useSimulatedFetch } from '@/lib/useSimulatedFetch'
import { raceService } from '@/services/raceService'
import { useCoachSessionSelection, useDriverSelection, useGpSelection, useSeasonSelection } from '@/lib/selection'
import type { CoachAnswer, CoachMetric, MetricTone } from '@/domain/models'
import { toneChipClass as toneChip, toneHex } from '@/lib/tone'
import { cn } from '@/lib/cn'

const MARK_A = raceService.driverColors.A
const MARK_B = raceService.driverColors.B

function confidenceLevel(v: number): { label: string; tone: MetricTone } {
  if (v >= 85) return { label: 'Alta', tone: 'green' }
  if (v >= 72) return { label: 'Media', tone: 'cyan' }
  return { label: 'Bassa', tone: 'amber' }
}

// --- chat messages ----------------------------------------------------------

function MetricChips({ metrics }: { metrics: CoachMetric[] }) {
  if (metrics.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {metrics.map((mtr) => (
        <span
          key={mtr.key + mtr.display}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border bg-base-800 px-2 py-1',
            toneChip[mtr.tone],
          )}
        >
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">{mtr.label}</span>
          <span className="tabular text-xs font-semibold">{mtr.display}</span>
        </span>
      ))}
    </div>
  )
}

function CoachMessage({ answer }: { answer: CoachAnswer }) {
  const conf = confidenceLevel(answer.confidence)
  return (
    <div className="flex animate-fade-up gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
        <GraduationCap className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-3 rounded-2xl rounded-tl-sm border border-line bg-base-800/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300">AI Coach</span>
          <Badge tone={conf.tone}>
            <ShieldCheck className="h-3 w-3" />
            Fiducia {conf.label} · {answer.confidence}%
          </Badge>
          {answer.focus && (
            <Badge tone="accent">
              <Crosshair className="h-3 w-3" />
              {answer.focus}
            </Badge>
          )}
        </div>
        <p className="text-sm font-semibold text-zinc-100">{answer.title}</p>
        <p className="text-sm leading-relaxed text-zinc-300">{answer.text}</p>
        <MetricChips metrics={answer.metrics} />
      </div>
    </div>
  )
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex animate-fade-up flex-row-reverse gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-base-700 text-zinc-300">
        <User className="h-4 w-4" />
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-base-700 px-4 py-2.5 text-sm text-zinc-100">
        {text}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex animate-fade-up gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
        <GraduationCap className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-line bg-base-800/70 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

// --- insight panel ----------------------------------------------------------

function MetricRow({ metric }: { metric: CoachMetric }) {
  return (
    <div className="px-5 py-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-zinc-400">{metric.label}</span>
        <span className="tabular text-xs font-semibold" style={{ color: toneHex[metric.tone] }}>
          {metric.display}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-base-700">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${metric.value}%`, backgroundColor: toneHex[metric.tone] }}
        />
      </div>
    </div>
  )
}

interface Msg {
  id: number
  role: 'user' | 'coach'
  text?: string
  answer?: CoachAnswer
}

// --- page -------------------------------------------------------------------

export function AICoach() {
  const [driverId, setDriverId] = useDriverSelection('coach.driver', 'ver')
  const [gpId, setGpId] = useGpSelection('coach.gp', 'ita')
  const [season, setSeason] = useSeasonSelection('coach.season', '2025')
  const [coachSession, setCoachSession] = useCoachSessionSelection('coach.session', 'Gara')

  const [messages, setMessages] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')
  const idRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  const insights = useMemo(
    () => raceService.getCoachInsights(driverId, gpId, season, coachSession),
    [driverId, gpId, season, coachSession],
  )
  const chartLoading = useSimulatedFetch([driverId, gpId, season, coachSession])
  const gp = raceService.getGrandsPrix().find((g) => g.id === gpId)!

  // Fresh opening read whenever the selection changes.
  useEffect(() => {
    setTyping(false)
    setMessages([
      {
        id: idRef.current++,
        role: 'coach',
        answer: raceService.askCoach('', driverId, gpId, season, coachSession),
      },
    ])
  }, [driverId, gpId, season, coachSession])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing])

  const respond = (question: string) => {
    setMessages((m) => [...m, { id: idRef.current++, role: 'user', text: question }])
    setTyping(true)
    window.setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: idRef.current++,
          role: 'coach',
          answer: raceService.askCoach(question, driverId, gpId, season, coachSession),
        },
      ])
      setTyping(false)
    }, 700)
  }

  const send = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    respond(text)
  }

  const conf = confidenceLevel(insights.confidence)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={GraduationCap}
        title="AI Coach"
        badge="beta"
        description="Il tuo analista di pista: capisci le prestazioni di un pilota o di una sessione. Risposte simulate su dati segnaposto, nessun modello reale collegato."
      />

      {/* 1 — Selection panel */}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Select
            label="Pilota"
            accent={MARK_A}
            options={raceService.getDrivers().map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))}
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          />
          <Select
            label="Gran Premio"
            options={raceService
              .getGrandsPrix()
              .map((g) => ({ value: g.id, label: `${g.name} — ${g.circuit}` }))}
            value={gpId}
            onChange={(e) => setGpId(e.target.value)}
          />
          <Select
            label="Sessione"
            options={raceService.getCoachSessions().map((s) => ({ value: s, label: s }))}
            value={coachSession}
            onChange={(e) => setCoachSession(e.target.value)}
          />
          <Select
            label="Stagione"
            options={raceService.getSeasons().map((s) => ({ value: s, label: s }))}
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 2 — Chat */}
        <Card className="flex h-[560px] flex-col overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Sparkles className="h-4 w-4 text-signal-purple" />
            <span className="text-sm font-medium text-zinc-200">AI Coach</span>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-signal-green">
              <span className="h-2 w-2 animate-pulse rounded-full bg-signal-green" />
              online
            </span>
          </div>
          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.map((m) =>
              m.role === 'coach' && m.answer ? (
                <CoachMessage key={m.id} answer={m.answer} />
              ) : (
                <UserMessage key={m.id} text={m.text ?? ''} />
              ),
            )}
            {typing && <TypingIndicator />}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
            {raceService.getCoachPrompts().map((q) => (
              <button
                key={q}
                onClick={() => respond(q)}
                className="rounded-full border border-line bg-base-850 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-line-strong hover:text-white"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="border-t border-line p-3">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-base-900 px-3 py-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Chiedi al coach (es. dove perde tempo, come migliorare…)"
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
              <button
                onClick={send}
                disabled={!input.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Invia"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-zinc-600">
              Risposte simulate su dati segnaposto · nessun modello collegato
            </p>
          </div>
        </Card>

        {/* 3 — Insight panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-zinc-200">Insight sessione</h3>
            <Badge tone={conf.tone}>
              <ShieldCheck className="h-3 w-3" />
              {conf.label} · {insights.confidence}%
            </Badge>
          </div>

          <Card>
            <CardBody className="space-y-3">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Punti di forza
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {insights.strengths.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-signal-green/30 bg-base-800 px-2 py-1 text-xs text-signal-green"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Punti deboli
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {insights.weaknesses.map((w) => (
                    <span
                      key={w}
                      className="rounded-md border border-signal-amber/30 bg-base-800 px-2 py-1 text-xs text-signal-amber"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="px-0 py-1">
              <div className="divide-y divide-line">
                {insights.metrics.map((metric) => (
                  <MetricRow key={metric.key} metric={metric} />
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Chart + timeline */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Andamento sessione"
            subtitle={`${insights.code} vs ${insights.refCode} · ${coachSession}`}
            action={<Badge tone="cyan">demo</Badge>}
          />
          <CardBody>
            {chartLoading ? (
              <ChartSkeleton />
            ) : (
              <LapTimeChart
                seriesA={insights.lapSeries}
                seriesB={insights.refLapSeries}
                codeA={insights.code}
                codeB={insights.refCode}
                colorA={MARK_A}
                colorB={MARK_B}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Timeline sessione" subtitle={gp.circuit} />
          <CardBody className="px-0 py-0">
            <ul className="divide-y divide-line">
              {insights.timeline.map((ev, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: toneHex[ev.tone] }} />
                  <span className="tabular w-14 shrink-0 text-xs text-zinc-500">Giro {ev.lap}</span>
                  <span className="text-sm text-zinc-300">{ev.label}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
