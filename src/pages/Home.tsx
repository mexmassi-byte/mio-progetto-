import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Activity,
  Users,
  Dna,
  Sparkles,
  GraduationCap,
  Rewind,
  Swords,
  Bot,
  LayoutDashboard,
  Gauge,
  Radio,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

/** Minimal, tech wordmark — three telemetry bars + product name. */
function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-end justify-center gap-[3px] rounded-md border border-line bg-base-900 p-1.5">
        <span className="w-[3px] flex-1 rounded-full bg-accent" />
        <span className="w-[3px] flex-1 rounded-full bg-signal" style={{ height: '65%' }} />
        <span className="w-[3px] flex-1 rounded-full bg-zinc-300" style={{ height: '85%' }} />
      </div>
      <span className="text-sm font-semibold tracking-tight text-white">ThePaddockView</span>
    </div>
  )
}

/** Reveals its children with a light fade-up the first time they enter view. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// --- App preview mockup (hero centerpiece) ----------------------------------

function AppPreview() {
  const bars = [40, 62, 55, 78, 70, 88, 82, 95]
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-base-900 shadow-[0_40px_120px_-40px_rgba(225,6,0,0.35)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-line bg-base-850 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-base-600" />
        <span className="h-2.5 w-2.5 rounded-full bg-base-600" />
        <span className="h-2.5 w-2.5 rounded-full bg-base-600" />
        <span className="ml-3 flex-1 truncate rounded-md bg-base-900 px-3 py-1 text-[10px] text-zinc-600">
          thepaddockview.app / dashboard
        </span>
      </div>
      <div className="grid grid-cols-[128px_1fr]">
        {/* mini sidebar */}
        <div className="hidden flex-col gap-2 border-r border-line p-3 sm:flex">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="h-4 w-4 rounded bg-accent" />
            <span className="h-2 w-16 rounded bg-base-700" />
          </div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-base-700" />
              <span className={cn('h-2 rounded', i === 0 ? 'w-14 bg-accent/60' : 'w-12 bg-base-700')} />
            </div>
          ))}
        </div>
        {/* content */}
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="h-3 w-24 rounded bg-base-700" />
            <span className="h-4 w-14 rounded bg-accent/30" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['1:22.1', '327', '+0.02'].map((v, i) => (
              <div key={i} className="rounded-lg border border-line bg-base-850 p-2.5">
                <div className="mb-1.5 h-1.5 w-10 rounded bg-base-700" />
                <div className="tabular text-sm font-semibold text-zinc-200">{v}</div>
              </div>
            ))}
          </div>
          {/* mini chart */}
          <div className="rounded-lg border border-line bg-base-850 p-3">
            <svg viewBox="0 0 240 70" className="h-20 w-full">
              <polyline
                points={bars.map((b, i) => `${(i / (bars.length - 1)) * 240},${70 - (b / 100) * 60}`).join(' ')}
                fill="none"
                stroke="#e10600"
                strokeWidth="2"
              />
              <polyline
                points={bars.map((b, i) => `${(i / (bars.length - 1)) * 240},${70 - ((b - 12) / 100) * 60}`).join(' ')}
                fill="none"
                stroke="#0ea5c4"
                strokeWidth="2"
              />
            </svg>
          </div>
          {/* mini leaderboard */}
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-line bg-base-850 px-2.5 py-1.5">
                <span className="tabular text-[10px] text-zinc-600">{i + 1}</span>
                <span className="h-2 flex-1 rounded bg-base-700" style={{ maxWidth: `${70 - i * 12}%` }} />
                <span className={cn('h-2 w-8 rounded', i === 0 ? 'bg-accent/60' : 'bg-base-700')} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- data --------------------------------------------------------------------

interface Feature {
  icon: LucideIcon
  title: string
  desc: string
  to: string
}
const FEATURES: Feature[] = [
  { icon: Users, title: 'Driver Comparison', desc: 'Confronta due piloti giro su giro, settore per settore.', to: '/confronto-piloti' },
  { icon: Dna, title: 'Driver DNA', desc: 'Il profilo tecnico completo dello stile di guida di ogni pilota.', to: '/driver-dna' },
  { icon: Sparkles, title: 'Predict', desc: 'Simula un Gran Premio e ottieni probabilità e strategia.', to: '/predict' },
  { icon: GraduationCap, title: 'AI Coach', desc: 'Un analista di pista che ti spiega il perché dei numeri.', to: '/ai-coach' },
  { icon: Rewind, title: 'Race Replay', desc: 'Rivivi la gara con mappa del circuito e telemetria live.', to: '/race-replay' },
  { icon: Swords, title: 'Battle Mode', desc: 'Duelli testa a testa a categorie, con vincitore automatico.', to: '/battle-mode' },
]

const WHY = [
  { icon: Bot, title: 'AI-powered analysis', desc: 'Insight strategici generati dai dati, come da un vero race engineer.' },
  { icon: LayoutDashboard, title: 'Interactive dashboards', desc: 'Grafici e indicatori reattivi, pensati per leggere i dati al volo.' },
  { icon: Gauge, title: 'Driver insights', desc: 'Ritmo, gomme, costanza e stile di guida in un unico profilo.' },
  { icon: Sparkles, title: 'Race simulations', desc: 'Previsioni di gara con meteo, strategia e probabilità di podio.' },
  { icon: Radio, title: 'Real-time ready', desc: 'Architettura pronta per l’integrazione di dati in tempo reale.' },
]

const PREVIEWS = [
  { title: 'Driver DNA', kind: 'radar' as const },
  { title: 'Predict', kind: 'gauges' as const },
  { title: 'Race Replay', kind: 'track' as const },
]

function PreviewMock({ kind }: { kind: 'radar' | 'gauges' | 'track' }) {
  if (kind === 'radar') {
    return (
      <svg viewBox="0 0 120 120" className="h-32 w-full">
        {[36, 24, 12].map((r) => (
          <polygon
            key={r}
            points={Array.from({ length: 8 }, (_, i) => {
              const a = -Math.PI / 2 + (i * Math.PI) / 4
              return `${60 + r * Math.cos(a)},${60 + r * Math.sin(a)}`
            }).join(' ')}
            fill="none"
            stroke="#20202a"
          />
        ))}
        <polygon points="60,26 90,45 84,80 60,92 34,78 30,46" fill="rgba(225,6,0,0.15)" stroke="#e10600" strokeWidth="2" />
      </svg>
    )
  }
  if (kind === 'gauges') {
    return (
      <div className="flex h-32 items-center justify-center gap-4">
        {[{ v: 0.72, c: '#34d399' }, { v: 0.4, c: '#22d3ee' }, { v: 0.18, c: '#fbbf24' }].map((g, i) => {
          const C = 2 * Math.PI * 22
          return (
            <svg key={i} viewBox="0 0 56 56" className="h-16 w-16 -rotate-90">
              <circle cx="28" cy="28" r="22" fill="none" stroke="#20202a" strokeWidth="5" />
              <circle cx="28" cy="28" r="22" fill="none" stroke={g.c} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - g.v)} />
            </svg>
          )
        })}
      </div>
    )
  }
  return (
    <svg viewBox="0 0 200 120" className="h-32 w-full">
      <path d="M30,80 C20,40 60,25 100,35 C150,48 150,20 175,45 C195,66 150,95 110,90 C70,86 45,110 30,80 Z" fill="none" stroke="#2a2a34" strokeWidth="10" strokeLinejoin="round" />
      <circle cx="100" cy="35" r="5" fill="#e10600" />
      <circle cx="150" cy="70" r="5" fill="#0ea5c4" />
    </svg>
  )
}

// --- page --------------------------------------------------------------------

export function Home() {
  const navigate = useNavigate()
  const year = new Date().getFullYear()

  return (
    <div className="relative min-h-screen overflow-hidden bg-base-950 text-zinc-200">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:38px_38px]" />
      <div className="pointer-events-none absolute left-1/2 top-[-14%] h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-accent/20 blur-[130px] animate-glow-pulse" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden opacity-40">
        <div className="h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent animate-scan" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-line/60 bg-base-950/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
            <button onClick={() => scrollTo('features')} className="transition-colors hover:text-white">Features</button>
            <button onClick={() => scrollTo('why')} className="transition-colors hover:text-white">Why</button>
            <button onClick={() => scrollTo('preview')} className="transition-colors hover:text-white">Anteprima</button>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden text-sm font-medium text-zinc-400 transition-colors hover:text-white sm:block">
              Accedi
            </Link>
            <Button size="sm" onClick={() => navigate('/dashboard')}>
              Apri Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-6">
        {/* Hero */}
        <section className="pb-16 pt-14 text-center sm:pt-20">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-line bg-base-900/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400 backdrop-blur-sm">
            <Activity className="h-3 w-3 text-accent-soft" />
            F1 Data Platform · Beta
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl animate-fade-up text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl" style={{ animationDelay: '80ms' }}>
            Analyze Formula 1
            <br />
            <span className="text-gradient">like an engineer.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl animate-fade-up text-base leading-relaxed text-zinc-400 sm:text-lg" style={{ animationDelay: '160ms' }}>
            Telemetria, confronti tra piloti, Driver DNA, simulazioni di gara e
            assistenti AI — in un'unica piattaforma cockpit-grade, per chi legge i
            dati e non solo i risultati.
          </p>
          <div className="mt-8 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: '240ms' }}>
            <Button size="lg" className="group w-full px-7 sm:w-auto" onClick={() => navigate('/dashboard')}>
              Start Analysis
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" className="w-full px-7 sm:w-auto" onClick={() => scrollTo('features')}>
              Explore Features
            </Button>
          </div>

          {/* App preview centerpiece */}
          <div className="relative mx-auto mt-14 max-w-4xl animate-fade-up" style={{ animationDelay: '320ms' }}>
            <div className="pointer-events-none absolute -inset-x-8 -top-8 bottom-0 rounded-3xl bg-accent/5 blur-2xl" />
            <div className="relative">
              <AppPreview />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-line py-16">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Tutto il paddock, in un'app</h2>
              <p className="mt-3 text-sm text-zinc-500">Sei moduli per analizzare ogni aspetto del weekend di gara.</p>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <Reveal key={f.title} delay={(i % 3) * 80}>
                  <div className="group flex h-full flex-col rounded-xl border border-line bg-base-900/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:bg-base-850">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-base-800 text-accent-soft">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-zinc-100">{f.title}</h3>
                    <p className="mt-1.5 flex-1 text-sm text-zinc-500">{f.desc}</p>
                    <button
                      onClick={() => navigate(f.to)}
                      className="mt-4 inline-flex w-fit items-center gap-1 text-xs font-medium text-zinc-400 transition-colors group-hover:text-accent-soft"
                    >
                      Learn More
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </section>

        {/* Why */}
        <section id="why" className="scroll-mt-20 border-t border-line py-16">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Perché ThePaddockView</h2>
              <p className="mt-3 text-sm text-zinc-500">Progettata per trasformare i dati in decisioni.</p>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {WHY.map((w, i) => {
              const Icon = w.icon
              return (
                <Reveal key={w.title} delay={(i % 5) * 60}>
                  <div className="flex h-full flex-col rounded-xl border border-line bg-base-900/60 p-5">
                    <Icon className="h-5 w-5 text-signal" />
                    <h3 className="mt-3 text-sm font-semibold text-zinc-100">{w.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{w.desc}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </section>

        {/* Preview */}
        <section id="preview" className="scroll-mt-20 border-t border-line py-16">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Un'anteprima del cockpit</h2>
              <p className="mt-3 text-sm text-zinc-500">Interfacce pensate per i dati — anteprime dimostrative.</p>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {PREVIEWS.map((p, i) => (
              <Reveal key={p.title} delay={i * 90}>
                <div className="overflow-hidden rounded-xl border border-line bg-base-900">
                  <div className="flex items-center gap-2 border-b border-line bg-base-850 px-4 py-2.5">
                    <span className="h-2 w-2 rounded-full bg-base-600" />
                    <span className="h-2 w-2 rounded-full bg-base-600" />
                    <span className="ml-2 text-[11px] font-medium text-zinc-400">{p.title}</span>
                  </div>
                  <div className="p-5">
                    <PreviewMock kind={p.kind} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-base-850 via-base-900 to-base-950 px-6 py-14 text-center sm:px-12">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
              <h2 className="relative mx-auto max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                Start your Formula 1 analysis today.
              </h2>
              <p className="relative mx-auto mt-4 max-w-lg text-sm text-zinc-400">
                Apri il cockpit e inizia a leggere ogni sessione come un ingegnere di pista.
              </p>
              <div className="relative mt-8">
                <Button size="lg" className="group px-8" onClick={() => navigate('/dashboard')}>
                  Open Dashboard
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Logo />
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
            <button onClick={() => scrollTo('why')} className="transition-colors hover:text-zinc-200">About</button>
            <button onClick={() => scrollTo('features')} className="transition-colors hover:text-zinc-200">Features</button>
            <button className="cursor-default transition-colors hover:text-zinc-300">Privacy</button>
            <button className="cursor-default transition-colors hover:text-zinc-300">Contact</button>
          </nav>
          <div className="flex items-center gap-3 text-[11px] text-zinc-600">
            <span className="rounded-md border border-line bg-base-900 px-2 py-0.5 uppercase tracking-wider text-zinc-500">
              Version Beta
            </span>
            <span>© {year} ThePaddockView</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
