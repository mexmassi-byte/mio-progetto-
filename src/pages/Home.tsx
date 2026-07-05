import { useNavigate } from 'react-router-dom'
import { ArrowRight, Activity } from 'lucide-react'
import { Button } from '@/components/ui'

/** Minimal, tech wordmark — three telemetry bars + product name. */
function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-end justify-center gap-[3px] rounded-md border border-line bg-base-900 p-1.5">
        <span className="w-[3px] flex-1 rounded-full bg-accent" />
        <span className="w-[3px] flex-1 rounded-full bg-signal" style={{ height: '65%' }} />
        <span className="w-[3px] flex-1 rounded-full bg-zinc-300" style={{ height: '85%' }} />
      </div>
      <span className="text-sm font-semibold tracking-tight text-white">
        ThePaddockView
      </span>
    </div>
  )
}

const MODULES = ['Telemetry', 'Driver Comparison', 'Race Replay', 'Battle Mode']

export function Home() {
  const navigate = useNavigate()

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-base-950 text-zinc-200">
      {/* Ambient background — red glow, faint grid, moving scanline */}
      <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:38px_38px]" />
      <div className="pointer-events-none absolute left-1/2 top-[-18%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px] animate-glow-pulse" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-5%] h-[420px] w-[520px] rounded-full bg-signal/10 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent animate-scan" />
      </div>
      {/* Top/bottom vignette to deepen the black */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-base-950 via-transparent to-base-950" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl animate-fade-in items-center justify-between px-6 py-6">
        <Logo />
        <button
          onClick={() => navigate('/dashboard')}
          className="hidden items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white sm:flex"
        >
          Enter Dashboard
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-6">
        <div className="mx-auto max-w-3xl py-20 text-center">
          <span
            className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-line bg-base-900/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400 backdrop-blur-sm"
            style={{ animationDelay: '40ms' }}
          >
            <Activity className="h-3 w-3 text-accent-soft" />
            F1 Data Platform
          </span>

          <h1
            className="mt-7 animate-fade-up text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl"
            style={{ animationDelay: '120ms' }}
          >
            Analyze Formula 1
            <br />
            <span className="text-gradient">like an engineer</span>
          </h1>

          <p
            className="mx-auto mt-6 max-w-xl animate-fade-up text-base leading-relaxed text-zinc-400 sm:text-lg"
            style={{ animationDelay: '220ms' }}
          >
            Cockpit-grade telemetry, driver comparisons and race replays — in one
            clean, fast interface built for people who read the data, not just the
            results.
          </p>

          <div
            className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '320ms' }}
          >
            <Button
              size="lg"
              onClick={() => navigate('/dashboard')}
              className="group w-full px-7 sm:w-auto"
            >
              Enter Dashboard
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/confronto-piloti')}
              className="w-full px-7 sm:w-auto"
            >
              Explore modules
            </Button>
          </div>

          {/* Module rail — texture, no data */}
          <div
            className="mt-14 flex animate-fade-up flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-zinc-600"
            style={{ animationDelay: '440ms' }}
          >
            {MODULES.map((m, i) => (
              <span key={m} className="flex items-center gap-3">
                {i > 0 && <span className="h-1 w-1 rounded-full bg-base-600" />}
                <span className="uppercase tracking-[0.14em] transition-colors hover:text-zinc-300">
                  {m}
                </span>
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 py-6">
        <div className="flex flex-col items-center justify-between gap-2 border-t border-line pt-5 text-[11px] text-zinc-600 sm:flex-row">
          <span>© {new Date().getFullYear()} ThePaddockView</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-green" />
            Preview build · no live F1 data connected
          </span>
        </div>
      </footer>
    </div>
  )
}
