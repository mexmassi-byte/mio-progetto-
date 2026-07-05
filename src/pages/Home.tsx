import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Gauge,
  Users,
  Rewind,
  Swords,
  Bot,
  LayoutDashboard,
  Activity,
} from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'

const FEATURES = [
  {
    to: '/dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    text: 'Panoramica in tempo reale di stint, gomme e pace del weekend.',
  },
  {
    to: '/confronto-piloti',
    icon: Users,
    title: 'Confronto Piloti',
    text: 'Metti a confronto due piloti giro su giro, settore per settore.',
  },
  {
    to: '/race-replay',
    icon: Rewind,
    title: 'Race Replay',
    text: 'Rivivi la gara con timeline interattiva e mappa del tracciato.',
  },
  {
    to: '/battle-mode',
    icon: Swords,
    title: 'Battle Mode',
    text: 'Duelli testa a testa: gap, DRS e finestre di sorpasso.',
  },
]

export function Home() {
  const navigate = useNavigate()

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-base-850 via-base-900 to-base-950 px-6 py-14 sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-signal/10 blur-3xl" />

        <div className="relative max-w-2xl">
          <Badge tone="accent" className="mb-5">
            <Activity className="h-3 w-3" />
            Cockpit-grade analytics
          </Badge>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            Ogni millesimo,
            <br />
            <span className="text-gradient">sotto controllo.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-zinc-400">
            ThePaddockView è la piattaforma di telemetria che trasforma i dati
            di ogni sessione in decisioni. Confronta piloti, rivivi le gare e
            studia i duelli — tutto in un unico cockpit.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => navigate('/dashboard')}>
              Apri la Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/ai-race-engineer')}
            >
              <Bot className="h-4 w-4" />
              Scopri l'AI Engineer
            </Button>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-accent-soft" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Moduli
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <Link key={f.to} to={f.to} className="group">
                <Card interactive className="h-full p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-base-800 text-accent-soft">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-100">
                    {f.title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">{f.text}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors group-hover:text-accent-soft">
                    Esplora
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Note */}
      <p className="text-center text-xs text-zinc-600">
        Anteprima UI · dati Formula 1 reali non ancora collegati
      </p>
    </div>
  )
}
