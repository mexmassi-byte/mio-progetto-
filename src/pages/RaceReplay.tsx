import {
  Rewind,
  Play,
  SkipBack,
  SkipForward,
  Map,
  Settings2,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  EmptyState,
} from '@/components/ui'

export function RaceReplay() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Rewind}
        title="Race Replay"
        badge="anteprima"
        description="Rivivi la gara con timeline interattiva e mappa del tracciato. Controlli non ancora funzionali."
        actions={
          <Button variant="outline" size="sm">
            <Settings2 className="h-4 w-4" />
            Opzioni
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="Tracciato"
          subtitle="Vista in pianta · giro 41 / 58"
          action={<Badge tone="cyan">demo</Badge>}
        />
        <CardBody>
          <EmptyState
            icon={Map}
            title="Mappa del tracciato in arrivo"
            description="La posizione dei piloti sul circuito verrà animata qui con i dati GPS."
          />
        </CardBody>
      </Card>

      {/* Playback controls (decorative) */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" aria-label="Indietro">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button size="sm" aria-label="Play">
              <Play className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Avanti">
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Timeline track */}
          <div className="relative h-2 flex-1 rounded-full bg-base-700">
            <div className="absolute inset-y-0 left-0 w-[70%] rounded-full bg-gradient-to-r from-accent-muted to-accent" />
            <div className="absolute left-[70%] top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-base-950 bg-white" />
          </div>

          <span className="tabular w-24 text-right text-sm text-zinc-400">
            41 / 58
          </span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {['Gap tempo reale', 'Posizioni', 'Eventi gara'].map((title) => (
          <Card key={title}>
            <CardHeader title={title} subtitle="Segnaposto" />
            <CardBody>
              <EmptyState
                icon={Rewind}
                title="In arrivo"
                description="Disponibile con la telemetria collegata."
              />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
