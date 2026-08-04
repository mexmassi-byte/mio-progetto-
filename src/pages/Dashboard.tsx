import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Timer,
  Gauge,
  TrendingUp,
  Users,
  Rewind,
  Swords,
  Bot,
  ArrowRight,
  Trophy,
  CircleDot,
  Flag,
} from 'lucide-react'
import {
  PageHeader,
  StatCard,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Select,
  SegmentedControl,
} from '@/components/ui'
import { LapTimeChart } from '@/components/comparison/LapTimeChart'
import { ChartSkeleton } from '@/components/comparison/ChartSkeleton'
import { useSimulatedFetch } from '@/lib/useSimulatedFetch'
import { raceService } from '@/services/raceService'
import { useGpSelection, useSessionSelection } from '@/lib/selection'
import { formatLapTime } from '@/lib/format'
import { cn } from '@/lib/cn'

const MARK_A = raceService.driverColors.A
const MARK_B = raceService.driverColors.B

export function Dashboard() {
  const [gpId, setGpId] = useGpSelection('dashboard.gp', 'ita')
  const [session, setSession] = useSessionSelection('dashboard.session', 'Race')

  const gp = raceService.getGrandsPrix().find((g) => g.id === gpId)!

  // All session data comes from the service — the page performs no data
  // derivation of its own.
  const kpis = useMemo(() => raceService.getSessionKpis(gpId, session), [gpId, session])
  const leaderboard = useMemo(
    () => raceService.getSessionLeaderboard(gpId, session),
    [gpId, session],
  )
  const championship = useMemo(
    () => raceService.getChampionship(gpId, session),
    [gpId, session],
  )
  const leader = leaderboard[0].stats
  const second = leaderboard[1].stats
  const battle = useMemo(() => raceService.battle(leader, second), [leader, second])
  const insight = useMemo(
    () => raceService.getInsight('strategy', leader.driver.id, gpId, session),
    [leader, gpId, session],
  )

  const chartLoading = useSimulatedFetch([gpId, session])

  const quickAccess = [
    {
      to: '/confronto-piloti',
      icon: Users,
      title: 'Driver Comparison',
      desc: 'Confronto testa a testa su giro e settori',
      stat: `${leader.driver.code} vs ${second.driver.code}`,
    },
    {
      to: '/race-replay',
      icon: Rewind,
      title: 'Race Replay',
      desc: 'Rivivi la gara con la mappa del circuito',
      stat: `${gp.laps} giri`,
    },
    {
      to: '/battle-mode',
      icon: Swords,
      title: 'Battle Mode',
      desc: 'Duello a categorie tra due piloti',
      stat: `${battle.scoreA}–${battle.scoreB}`,
    },
    {
      to: '/ai-race-engineer',
      icon: Bot,
      title: 'AI Race Engineer',
      desc: 'Analisi strategica e suggerimenti gomme',
      stat: 'Insight pronti',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description={`Overview sessione · ${gp.name} · ${session}. Dati segnaposto coerenti, nessuna telemetria reale collegata.`}
      />

      {/* Session selector */}
      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Gran Premio"
            options={raceService
              .getGrandsPrix()
              .map((g) => ({ value: g.id, label: `${g.name} — ${g.circuit}` }))}
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

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Giro veloce"
          value={formatLapTime(kpis.fastestLap.seconds)}
          icon={Timer}
          delta={kpis.fastestLap.driver.code}
          trend="up"
          hint={kpis.fastestLap.driver.team}
        />
        <StatCard
          label="Top speed"
          value={`${kpis.topSpeed.value} km/h`}
          icon={Gauge}
          delta={kpis.topSpeed.driver.code}
          trend="up"
          hint="trappola DRS"
        />
        <StatCard
          label="Gap P1–P2"
          value={`+${kpis.gapP1P2.toFixed(3)}s`}
          icon={TrendingUp}
          delta={second.driver.code}
          trend="flat"
          hint="miglior giro"
        />
        <StatCard
          label="Piloti in sessione"
          value={`${kpis.driverCount}`}
          icon={Flag}
          hint={`${gp.circuit} · ${gp.laps} giri`}
        />
      </div>

      {/* Quick access */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Accesso rapido
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickAccess.map((q) => {
            const Icon = q.icon
            return (
              <Link key={q.to} to={q.to} className="group">
                <Card interactive className="h-full p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-base-800 text-accent-soft">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge tone="neutral" className="tabular">
                      {q.stat}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-100">{q.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500">{q.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors group-hover:text-accent-soft">
                    Apri
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Main grid: pace chart + session leaderboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Andamento sessione"
            subtitle={`Passo dei due piloti di vertice · ${gp.name}`}
            action={<Badge tone="cyan">demo</Badge>}
          />
          <CardBody>
            {chartLoading ? (
              <ChartSkeleton />
            ) : (
              <LapTimeChart
                seriesA={leader.lapSeries}
                seriesB={second.lapSeries}
                codeA={leader.driver.code}
                codeB={second.driver.code}
                colorA={MARK_A}
                colorB={MARK_B}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Classifica sessione" subtitle="Per miglior giro" />
          <CardBody className="px-0 py-0">
            <ul className="divide-y divide-line">
              {leaderboard.slice(0, 8).map((row) => (
                <li key={row.stats.driver.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="tabular w-5 text-sm font-semibold text-zinc-500">
                    {row.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {row.stats.driver.name}
                    </p>
                    <p className="truncate text-[11px] text-zinc-600">
                      {row.stats.driver.team}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'tabular text-xs font-semibold',
                      row.rank === 1 ? 'text-accent-soft' : 'text-zinc-500',
                    )}
                  >
                    {row.rank === 1 ? formatLapTime(row.stats.lapTime) : `+${row.gap.toFixed(3)}`}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* Secondary: featured battle + AI insight teaser */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Duello in evidenza"
            subtitle="I due piloti più veloci"
            action={
              <Link
                to="/battle-mode"
                className="flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-accent-soft"
              >
                Battle Mode
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <CardBody>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ backgroundColor: MARK_A }}
                >
                  {leader.driver.code}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{leader.driver.name}</p>
                  <p className="text-xs text-zinc-600">{leader.driver.team}</p>
                </div>
              </div>
              <div className="tabular flex items-center gap-2 text-lg font-bold">
                <span style={{ color: MARK_A }}>{battle.scoreA}</span>
                <Swords className="h-4 w-4 text-zinc-600" />
                <span style={{ color: MARK_B }}>{battle.scoreB}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-zinc-100">{second.driver.name}</p>
                  <p className="text-xs text-zinc-600">{second.driver.team}</p>
                </div>
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold text-base-950"
                  style={{ backgroundColor: MARK_B }}
                >
                  {second.driver.code}
                </div>
              </div>
            </div>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-base-700">
              <div style={{ width: `${(battle.scoreA / 8) * 100}%`, backgroundColor: MARK_A }} />
              <div style={{ width: `${(battle.scoreB / 8) * 100}%`, backgroundColor: MARK_B }} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Insight del giorno"
            subtitle="Dal tuo AI Race Engineer"
            action={
              <Link
                to="/ai-race-engineer"
                className="flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-accent-soft"
              >
                Apri
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">{insight.title}</p>
                <p className="text-xs text-zinc-500">
                  {leader.driver.name} · {gp.name}
                </p>
              </div>
            </div>
            <p className="text-sm text-zinc-400">{insight.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {insight.metrics.slice(0, 3).map((m) => (
                <span
                  key={m.label}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-base-800 px-2 py-1"
                >
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {m.label}
                  </span>
                  <span className="tabular text-xs font-semibold text-zinc-200">{m.value}</span>
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Championship snapshot */}
      <Card>
        <CardHeader
          title="Snapshot campionato"
          subtitle="Vertice classifica piloti"
          action={<Badge tone="cyan">demo</Badge>}
        />
        <CardBody className="px-0 py-0">
          <ul className="divide-y divide-line sm:grid sm:grid-cols-2 sm:divide-y-0">
            {championship.map((entry) => (
              <li
                key={entry.driver.id}
                className="flex items-center gap-3 px-5 py-3 sm:odd:border-r sm:odd:border-line"
              >
                {entry.rank === 1 ? (
                  <Trophy className="h-4 w-4 text-signal-amber" />
                ) : (
                  <CircleDot className="h-3.5 w-3.5 text-zinc-600" />
                )}
                <span className="tabular w-5 text-sm font-semibold text-zinc-500">
                  {entry.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {entry.driver.name}
                  </p>
                </div>
                <span className="tabular text-sm font-semibold text-zinc-100">
                  {entry.points}
                </span>
                <span className="text-[11px] text-zinc-600">pt</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
