import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Catches render/runtime crashes anywhere below it and shows a recoverable
 * screen instead of a blank page. Without this, a single thrown error in any
 * component unmounts the whole tree and the user sees white.
 *
 * When error tracking is added (Sentry & co.), report from `componentDidCatch`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Hook point for an error-reporting service.
    console.error('[ThePaddockView] Errore non gestito:', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-base-950 px-6">
        <div className="w-full max-w-md rounded-2xl border border-line bg-base-900 p-8 text-center shadow-panel">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-base-800 text-signal-amber">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-lg font-semibold text-white">Qualcosa è andato storto</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Si è verificato un errore imprevisto. Puoi riprovare: i tuoi dati e le tue
            preferenze restano salvati.
          </p>
          <p className="mt-3 break-words rounded-lg border border-line bg-base-850 px-3 py-2 text-left text-[11px] text-zinc-600">
            {error.message}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={this.reset}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-soft"
            >
              <RotateCw className="h-4 w-4" />
              Riprova
            </button>
            <a
              href="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-zinc-200 transition-colors hover:bg-base-800"
            >
              <Home className="h-4 w-4" />
              Torna alla home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
