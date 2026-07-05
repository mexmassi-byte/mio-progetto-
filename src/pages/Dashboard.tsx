import {
  LayoutDashboard,
  Timer,
  Flag,
  Gauge,
  TrendingUp,
  BarChart3,
  CircleDot,
  Download,
} from 'lucide-react'
import {
  PageHeader,
  StatCard,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Button,
  EmptyState,
} from '@/components/ui'

const STANDINGS = [
  { pos: 1, driver: 'M. Verstappen', team: 'Red Bull', pts: 285, tone: 'accent' },
  { pos: 2, driver: 'L. Norris', team: 'McLaren', pts: 241, tone: 'amber' },
  { pos: 3, driver: 'C. Leclerc', team: 'Ferrari', pts: 217, tone: 'accent' },
  { pos: 4, driver: 'O. Piastri', team: 'McLaren', pts: 203, tone: 'amber' },
  { pos: 5, driver: 'C. Sainz', team: 'Ferrari', pts: 190, tone: 'accent' },
] as const

export function Dashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Panoramica del weekend di gara. I valori mostrati sono segnaposto dimostrativi."
        actions={
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Esporta
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Giro veloce"
          value="1:18.442"
          icon={Timer}
          delta="-0.212s"
          trend="up"
          hint="vs. pole provvisoria"
        />
        <StatCard
          label="Gap al leader"
          value="+3.8s"
          icon={TrendingUp}
          delta="-1.2s"
          trend="up"
          hint="ultimi 5 giri"
        />
        <StatCard
          label="Giri completati"
          value="41 / 58"
          icon={Flag}
          delta="70%"
          trend="flat"
          hint="stint corrente: Medium"
        />
        <StatCard
          label="Top speed"
          value="327 km/h"
          icon={Gauge}
          delta="+4 km/h"
          trend="up"
          hint="trappola DRS S2"
        />
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Andamento pace"
            subtitle="Tempo sul giro per stint"
            action={<Badge tone="cyan">demo</Badge>}
          />
          <CardBody>
            <EmptyState
              icon={BarChart3}
              title="Grafico non ancora collegato"
              description="Qui comparirà il grafico dei tempi sul giro quando i dati di telemetria verranno integrati."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Classifica" subtitle="Campionato piloti" />
          <CardBody className="px-0 py-0">
            <ul className="divide-y divide-line">
              {STANDINGS.map((row) => (
                <li
                  key={row.pos}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <span className="tabular w-5 text-sm font-semibold text-zinc-500">
                    {row.pos}
                  </span>
                  <CircleDot
                    className={
                      row.tone === 'amber'
                        ? 'h-3.5 w-3.5 text-signal-amber'
                        : 'h-3.5 w-3.5 text-accent-soft'
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {row.driver}
                    </p>
                    <p className="truncate text-xs text-zinc-600">{row.team}</p>
                  </div>
                  <span className="tabular text-sm font-semibold text-zinc-100">
                    {row.pts}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* Secondary row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Strategia gomme" subtitle="Finestra pit stop" />
          <CardBody>
            <EmptyState
              icon={CircleDot}
              title="Modulo strategia in arrivo"
              description="Degrado, undercut e finestre di sosta verranno calcolati dai dati reali."
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Settori" subtitle="Delta per micro-settore" />
          <CardBody>
            <EmptyState
              icon={BarChart3}
              title="Analisi settori in arrivo"
              description="Il confronto per settore sarà disponibile con la telemetria collegata."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
