import { useEffect, useMemo, useState } from 'react'
import { Swords, ArrowLeftRight, Crown, Check, Trophy, Minus } from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
} from '@/components/ui'
import { MatchControls } from '@/components/comparison/MatchControls'
import { raceService } from '@/services/raceService'
import { useDriverSelection, useGpSelection, useSessionSelection } from '@/lib/selection'
import type {
  DriverStats,
  MetricRow,
  Winner,
} from '@/domain/models'
import { cn } from '@/lib/cn'

const MARK_A = raceService.driverColors.A
const MARK_B = raceService.driverColors.B

const winnerText: Record<Winner, string> = {
  A: 'text-accent-soft',
  B: 'text-signal',
  tie: 'text-zinc-400',
}

// --- Versus hero card -------------------------------------------------------

function CombatantCard({
  data,
  side,
  score,
  isOverall,
}: {
  data: DriverStats
  side: 'A' | 'B'
  score: number
  isOverall: boolean
}) {
  const color = side === 'A' ? MARK_A : MARK_B
  const alignRight = side === 'B'
  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 rounded-xl border p-5 transition-colors',
        isOverall ? 'bg-base-850' : 'border-line bg-base-900',
      )}
      style={isOverall ? { borderColor: color } : undefined}
    >
      {isOverall && (
        <Crown
          className="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 animate-fade-up"
          style={{ color }}
          fill={color}
        />
      )}
      <div
        className={cn(
          'flex items-center gap-3',
          alignRight && 'flex-row-reverse text-right',
        )}
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {data.driver.code}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">
            {data.driver.name}
          </p>
          <p className="truncate text-xs text-zinc-500">{data.driver.team}</p>
        </div>
      </div>
      <div className={cn('flex items-baseline gap-2', alignRight && 'justify-end')}>
        <span className="tabular text-3xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-xs uppercase tracking-wider text-zinc-600">
          {score === 1 ? 'categoria vinta' : 'categorie vinte'}
        </span>
      </div>
      <Badge
        tone={side === 'A' ? 'accent' : 'cyan'}
        className={cn('w-fit', alignRight && 'self-end')}
      >
        Driver {side}
      </Badge>
    </div>
  )
}

// --- Battle bar (animated tug-of-war) ---------------------------------------

function BattleBar({ row, animated }: { row: MetricRow; animated: boolean }) {
  const widthA = animated ? row.shareA : 0.5
  return (
    <div className="px-5 py-3.5">
      <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {row.label}
      </p>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'tabular flex w-24 shrink-0 items-center justify-end gap-1 text-sm font-semibold',
            row.winner === 'A' ? winnerText.A : 'text-zinc-500',
          )}
        >
          {row.winner === 'A' && <Check className="h-3.5 w-3.5" />}
          {row.displayA}
        </span>

        <div className="flex h-2.5 flex-1 items-center gap-[2px]">
          <div className="flex h-full flex-1 justify-end overflow-hidden rounded-l-full bg-base-700">
            <div
              className="h-full rounded-l-full transition-[width] duration-700 ease-out"
              style={{ width: `${widthA * 100}%`, backgroundColor: MARK_A }}
            />
          </div>
          <div className="flex h-full flex-1 overflow-hidden rounded-r-full bg-base-700">
            <div
              className="h-full rounded-r-full transition-[width] duration-700 ease-out"
              style={{ width: `${(1 - widthA) * 100}%`, backgroundColor: MARK_B }}
            />
          </div>
        </div>

        <span
          className={cn(
            'tabular flex w-24 shrink-0 items-center gap-1 text-sm font-semibold',
            row.winner === 'B' ? winnerText.B : 'text-zinc-500',
          )}
        >
          {row.displayB}
          {row.winner === 'B' && <Check className="h-3.5 w-3.5" />}
        </span>
      </div>
    </div>
  )
}

// --- Page -------------------------------------------------------------------

export function BattleMode() {
  const [driverAId, setDriverAId] = useDriverSelection('battle.driverA', 'ver')
  const [driverBId, setDriverBId] = useDriverSelection('battle.driverB', 'lec')
  const [gpId, setGpId] = useGpSelection('battle.gp', 'ita')
  const [session, setSession] = useSessionSelection('battle.session', 'Race')

  const dataA = useMemo(
    () => raceService.getDriverStats(driverAId, gpId, session),
    [driverAId, gpId, session],
  )
  const dataB = useMemo(
    () => raceService.getDriverStats(driverBId, gpId, session),
    [driverBId, gpId, session],
  )
  const battle = useMemo(() => raceService.battle(dataA, dataB), [dataA, dataB])

  // Battle bars replay from centre on mount and on every selection change,
  // so a new duel is visibly "fought" rather than silently swapped.
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    setAnimated(false)
    const t = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(t)
  }, [driverAId, driverBId, gpId, session])

  const gp = raceService.getGrandsPrix().find((g) => g.id === gpId)!
  const swap = () => {
    setDriverAId(driverBId)
    setDriverBId(driverAId)
  }

  const overallWinner =
    battle.overall === 'A' ? dataA : battle.overall === 'B' ? dataB : null

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Swords}
        title="Battle Mode"
        badge="anteprima"
        description={`Duello testa a testa · ${gp.name} · ${session}. Dati segnaposto, nessuna telemetria reale collegata.`}
        actions={
          <Button size="sm" variant="outline" onClick={swap}>
            <ArrowLeftRight className="h-4 w-4" />
            Scambia
          </Button>
        }
      />

      <MatchControls
        driverAId={driverAId}
        driverBId={driverBId}
        gpId={gpId}
        session={session}
        onDriverA={setDriverAId}
        onDriverB={setDriverBId}
        onGp={setGpId}
        onSession={setSession}
      />

      {/* Versus hero */}
      <Card className="overflow-hidden">
        <div className="relative grid grid-cols-1 items-center gap-4 p-6 md:grid-cols-[1fr_auto_1fr]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-signal/5" />
          <CombatantCard
            data={dataA}
            side="A"
            score={battle.scoreA}
            isOverall={battle.overall === 'A'}
          />
          <div className="relative flex flex-col items-center gap-2 py-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-base-800 shadow-glow animate-glow-pulse">
              <Swords className="h-6 w-6 text-zinc-300" />
            </div>
            <div className="tabular flex items-center gap-2 text-lg font-bold">
              <span style={{ color: MARK_A }}>{battle.scoreA}</span>
              <span className="text-zinc-600">–</span>
              <span style={{ color: MARK_B }}>{battle.scoreB}</span>
            </div>
          </div>
          <CombatantCard
            data={dataB}
            side="B"
            score={battle.scoreB}
            isOverall={battle.overall === 'B'}
          />
        </div>
      </Card>

      {/* Category battle */}
      <Card>
        <CardHeader
          title="Head to Head"
          subtitle="8 categorie · vincitore evidenziato"
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
            {battle.rows.map((row) => (
              <BattleBar key={row.key} row={row} animated={animated} />
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Final verdict */}
      <Card>
        <CardHeader title="Verdetto" subtitle="Pilota complessivamente migliore" action={<Badge tone="cyan">demo</Badge>} />
        <CardBody>
          <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-base-850 p-6 text-center animate-fade-up">
            {overallWinner ? (
              <>
                <Trophy className="h-7 w-7 text-signal-amber" />
                <p className="text-sm text-zinc-400">Vince il duello</p>
                <p className="text-xl font-semibold text-white">
                  {overallWinner.driver.name}
                </p>
                <div className="tabular flex items-center gap-3 text-2xl font-bold">
                  <span style={{ color: MARK_A }}>{battle.scoreA}</span>
                  <span className="text-xs uppercase tracking-wider text-zinc-600">
                    vs
                  </span>
                  <span style={{ color: MARK_B }}>{battle.scoreB}</span>
                </div>
              </>
            ) : (
              <>
                <Minus className="h-7 w-7 text-zinc-500" />
                <p className="text-xl font-semibold text-white">Duello in parità</p>
                <p className="text-sm text-zinc-500">
                  {battle.scoreA} – {battle.scoreB} tra i due piloti
                </p>
              </>
            )}
          </div>

          {/* Per-category winner chips */}
          <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {battle.rows.map((r) => {
              const code =
                r.winner === 'A'
                  ? dataA.driver.code
                  : r.winner === 'B'
                    ? dataB.driver.code
                    : '—'
              const color =
                r.winner === 'A' ? MARK_A : r.winner === 'B' ? MARK_B : '#3f3f46'
              return (
                <li
                  key={r.key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-base-900 px-3 py-2"
                >
                  <span className="truncate text-xs text-zinc-400">{r.label}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-zinc-200">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    {code}
                  </span>
                </li>
              )
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
