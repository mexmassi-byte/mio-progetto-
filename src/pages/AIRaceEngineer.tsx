import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Send, Sparkles, User, Radio, Swords } from 'lucide-react'
import { PageHeader, Card, Badge, Select, SegmentedControl } from '@/components/ui'
import { raceService } from '@/services/raceService'
import type {
  SessionType,
  Insight,
  InsightKind,
  MetricTone,
} from '@/domain/models'
import { formatLapTime } from '@/lib/format'
import { cn } from '@/lib/cn'

const MARK_A = raceService.driverColors.A
const MARK_B = raceService.driverColors.B

const toneChip: Record<MetricTone, string> = {
  accent: 'border-accent/30 text-accent-soft',
  cyan: 'border-signal/30 text-signal',
  green: 'border-signal-green/30 text-signal-green',
  amber: 'border-signal-amber/30 text-signal-amber',
  purple: 'border-signal-purple/30 text-signal-purple',
  neutral: 'border-line text-zinc-300',
}

const kindTag: Record<InsightKind, string> = {
  briefing: 'Briefing',
  pace: 'Ritmo',
  strategy: 'Strategia',
  rival: 'Rivale',
  swot: 'Analisi',
}

// --- message rendering ------------------------------------------------------

function MetricChips({ metrics }: { metrics: Insight['metrics'] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {metrics.map((m) => (
        <span
          key={m.label}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border bg-base-800 px-2 py-1',
            toneChip[m.tone ?? 'neutral'],
          )}
        >
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            {m.label}
          </span>
          <span className="tabular text-xs font-semibold">{m.value}</span>
        </span>
      ))}
    </div>
  )
}

function EngineerMessage({ insight }: { insight: Insight }) {
  return (
    <div className="flex animate-fade-up gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
        <Bot className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-3 rounded-2xl rounded-tl-sm border border-line bg-base-800/70 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300">Race Engineer</span>
          <Badge tone="purple">{kindTag[insight.kind]}</Badge>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">{insight.title}</p>
          <p className="mt-0.5 text-sm text-zinc-400">{insight.summary}</p>
        </div>
        <MetricChips metrics={insight.metrics} />
        <div className="space-y-3">
          {insight.sections.map((sec, i) => (
            <div key={i}>
              {sec.heading && (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {sec.heading}
                </p>
              )}
              <ul className="space-y-1.5">
                {sec.bullets.map((b, j) => (
                  <li key={j} className="flex gap-2 text-sm leading-relaxed text-zinc-300">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
        <Bot className="h-4 w-4" />
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

interface Msg {
  id: number
  role: 'user' | 'engineer'
  text?: string
  insight?: Insight
}

// --- page -------------------------------------------------------------------

export function AIRaceEngineer() {
  const [driverId, setDriverId] = useState('ver')
  const [gpId, setGpId] = useState('ita')
  const [session, setSession] = useState<SessionType>('Race')

  const [messages, setMessages] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')
  const idRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  const me = useMemo(
    () => raceService.getDriverStats(driverId, gpId, session),
    [driverId, gpId, session],
  )
  const rival = useMemo(
    () => raceService.getRival(driverId, gpId, session),
    [driverId, gpId, session],
  )
  const gap = useMemo(() => raceService.compareDrivers(me, rival).gap, [me, rival])

  // Fresh briefing whenever the selection changes.
  useEffect(() => {
    setTyping(false)
    setMessages([
      {
        id: idRef.current++,
        role: 'engineer',
        insight: raceService.getInsight('briefing', driverId, gpId, session),
      },
    ])
  }, [driverId, gpId, session])

  // Keep the conversation scrolled to the latest message.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing])

  const respond = (kind: InsightKind, userLabel: string) => {
    setMessages((m) => [...m, { id: idRef.current++, role: 'user', text: userLabel }])
    setTyping(true)
    window.setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: idRef.current++,
          role: 'engineer',
          insight: raceService.getInsight(kind, driverId, gpId, session),
        },
      ])
      setTyping(false)
    }, 650)
  }

  const send = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    respond(raceService.detectInsightKind(text), text)
  }

  const driverOptions = raceService
    .getDrivers()
    .map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))
  const gpOptions = raceService
    .getGrandsPrix()
    .map((g) => ({ value: g.id, label: `${g.name} — ${g.circuit}` }))

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bot}
        title="AI Race Engineer"
        badge="beta"
        description="Il tuo ingegnere di pista virtuale: analisi strategica su ritmo, gomme e rivali. Insight simulati su dati segnaposto, nessun modello o telemetria reale collegati."
      />

      {/* Controls */}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Select
            label="Pilota"
            accent={MARK_A}
            options={driverOptions}
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          />
          <Select
            label="Gran Premio"
            options={gpOptions}
            value={gpId}
            onChange={(e) => setGpId(e.target.value)}
          />
          <SegmentedControl
            label="Sessione"
            options={raceService.getSessions()}
            value={session}
            onChange={setSession}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chat */}
        <Card className="flex h-[620px] flex-col overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Sparkles className="h-4 w-4 text-signal-purple" />
            <span className="text-sm font-medium text-zinc-200">Race Engineer</span>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-signal-green">
              <span className="h-2 w-2 animate-pulse rounded-full bg-signal-green" />
              online
            </span>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.map((m) =>
              m.role === 'engineer' && m.insight ? (
                <EngineerMessage key={m.id} insight={m.insight} />
              ) : (
                <UserMessage key={m.id} text={m.text ?? ''} />
              ),
            )}
            {typing && <TypingIndicator />}
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
            {raceService.getQuickActions().map((q) => (
              <button
                key={q.kind}
                onClick={() => respond(q.kind, q.label)}
                className="rounded-full border border-line bg-base-850 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-base-600 hover:text-white"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-line p-3">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-base-900 px-3 py-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Chiedi al tuo ingegnere (es. finestra pit, ritmo gara, rivale…)"
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

        {/* Session context side panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-zinc-200">Contesto sessione</h3>
            <Badge tone="cyan">demo</Badge>
          </div>

          <Card className="overflow-hidden">
            <div
              className="flex items-center gap-3 border-b border-line px-4 py-3"
              style={{ boxShadow: `inset 3px 0 0 0 ${MARK_A}` }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: MARK_A }}
              >
                {me.driver.code}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{me.driver.name}</p>
                <p className="truncate text-[11px] text-zinc-600">{me.driver.team}</p>
              </div>
            </div>
            <div className="divide-y divide-line text-sm">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-zinc-500">Passo medio</span>
                <span className="tabular font-semibold text-signal">{formatLapTime(me.racePace)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-zinc-500">Best lap</span>
                <span className="tabular font-semibold text-accent-soft">{formatLapTime(me.lapTime)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-zinc-500">Gomma</span>
                <span className="tabular font-semibold text-signal-purple">
                  {me.tyreCompound} · {me.tyreAge}L
                </span>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <Swords className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Rivale diretto
              </span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-base-950"
                style={{ backgroundColor: MARK_B }}
              >
                {rival.driver.code}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-100">{rival.driver.name}</p>
                <p className="truncate text-[11px] text-zinc-600">{rival.driver.team}</p>
              </div>
              <span
                className={cn(
                  'tabular text-sm font-semibold',
                  gap < 0 ? 'text-signal-green' : 'text-signal-amber',
                )}
              >
                {gap > 0 ? '+' : ''}
                {gap.toFixed(2)}s
              </span>
            </div>
          </Card>

          <div className="flex items-start gap-2 rounded-lg border border-line bg-base-900 px-4 py-3 text-xs text-zinc-500">
            <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-green" />
            <span>
              L'ingegnere aggiorna l'analisi ad ogni cambio di pilota, Gran Premio o sessione.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
