import { Users, Plus, GitCompareArrows, LineChart } from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  EmptyState,
} from '@/components/ui'
import { cn } from '@/lib/cn'

function DriverSlot({
  side,
  name,
  team,
  color,
}: {
  side: 'A' | 'B'
  name?: string
  team?: string
  color: string
}) {
  const empty = !name
  return (
    <Card
      interactive
      className="flex items-center gap-4 p-5"
    >
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white',
          empty ? 'border border-dashed border-line bg-base-800 text-zinc-600' : color,
        )}
      >
        {empty ? <Plus className="h-5 w-5" /> : side}
      </div>
      <div className="min-w-0 flex-1">
        {empty ? (
          <p className="text-sm font-medium text-zinc-500">
            Seleziona pilota {side}
          </p>
        ) : (
          <>
            <p className="truncate text-sm font-semibold text-zinc-100">{name}</p>
            <p className="truncate text-xs text-zinc-600">{team}</p>
          </>
        )}
      </div>
      <Badge tone={side === 'A' ? 'accent' : 'cyan'}>Pilota {side}</Badge>
    </Card>
  )
}

const METRICS = [
  { label: 'Miglior giro', a: '1:18.44', b: '1:18.61' },
  { label: 'Media stint', a: '1:19.87', b: '1:19.72' },
  { label: 'Top speed', a: '327', b: '324' },
  { label: 'Settore 1', a: '24.11', b: '24.30' },
  { label: 'Settore 2', a: '31.44', b: '31.28' },
  { label: 'Settore 3', a: '22.89', b: '23.03' },
]

export function DriverComparison() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Confronto Piloti"
        badge="anteprima"
        description="Confronta due piloti su giro, settori e velocità. Interfaccia dimostrativa senza dati reali."
        actions={
          <Button size="sm">
            <GitCompareArrows className="h-4 w-4" />
            Confronta
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <DriverSlot
          side="A"
          name="M. Verstappen"
          team="Red Bull Racing"
          color="bg-accent"
        />
        <DriverSlot side="B" name="L. Norris" team="McLaren" color="bg-signal" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Overlay giro"
            subtitle="Delta cumulativo A vs B"
            action={<Badge tone="cyan">demo</Badge>}
          />
          <CardBody>
            <EmptyState
              icon={LineChart}
              title="Overlay non ancora collegato"
              description="La traccia di confronto giro-su-giro apparirà qui una volta integrata la telemetria."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Metriche" subtitle="Valori segnaposto" />
          <CardBody className="px-0 py-0">
            <ul className="divide-y divide-line">
              {METRICS.map((m) => {
                const aWins = parseFloat(m.a) <= parseFloat(m.b)
                return (
                  <li key={m.label} className="grid grid-cols-3 items-center px-5 py-2.5">
                    <span
                      className={cn(
                        'tabular text-sm font-semibold',
                        aWins ? 'text-accent-soft' : 'text-zinc-400',
                      )}
                    >
                      {m.a}
                    </span>
                    <span className="text-center text-[11px] uppercase tracking-wider text-zinc-600">
                      {m.label}
                    </span>
                    <span
                      className={cn(
                        'tabular text-right text-sm font-semibold',
                        !aWins ? 'text-signal' : 'text-zinc-400',
                      )}
                    >
                      {m.b}
                    </span>
                  </li>
                )
              })}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
