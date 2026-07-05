import { Swords, Zap, Radar, ArrowLeftRight } from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Button,
  EmptyState,
} from '@/components/ui'

function Combatant({
  name,
  team,
  gap,
  side,
}: {
  name: string
  team: string
  gap: string
  side: 'left' | 'right'
}) {
  return (
    <div
      className={
        side === 'left'
          ? 'flex items-center gap-4'
          : 'flex flex-row-reverse items-center gap-4 text-right'
      }
    >
      <div
        className={
          side === 'left'
            ? 'flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white shadow-glow'
            : 'flex h-14 w-14 items-center justify-center rounded-xl bg-signal text-lg font-bold text-base-950'
        }
      >
        {name.split(' ').pop()?.slice(0, 3).toUpperCase()}
      </div>
      <div>
        <p className="text-base font-semibold text-white">{name}</p>
        <p className="text-xs text-zinc-500">{team}</p>
        <p className="tabular mt-1 text-sm font-medium text-zinc-300">{gap}</p>
      </div>
    </div>
  )
}

export function BattleMode() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Swords}
        title="Battle Mode"
        badge="anteprima"
        description="Duelli testa a testa: gap, DRS e finestre di sorpasso. Contenuti dimostrativi."
        actions={
          <Button size="sm">
            <ArrowLeftRight className="h-4 w-4" />
            Cambia duello
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="relative grid grid-cols-1 items-center gap-6 p-6 sm:grid-cols-[1fr_auto_1fr]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-signal/5" />
          <Combatant
            name="M. Verstappen"
            team="Red Bull Racing"
            gap="Leader"
            side="left"
          />
          <div className="relative flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-base-800">
              <Swords className="h-5 w-5 text-zinc-400" />
            </div>
          </div>
          <Combatant
            name="L. Norris"
            team="McLaren"
            gap="+0.412s"
            side="right"
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Gap dinamico"
            subtitle="Distacco giro per giro"
            action={<Badge tone="cyan">demo</Badge>}
          />
          <CardBody>
            <EmptyState
              icon={Radar}
              title="Grafico duello in arrivo"
              description="L'evoluzione del gap e le zone DRS saranno tracciate con i dati reali."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Finestre DRS" subtitle="Segnaposto" />
          <CardBody>
            <EmptyState
              icon={Zap}
              title="In arrivo"
              description="Le opportunità di sorpasso verranno evidenziate qui."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
