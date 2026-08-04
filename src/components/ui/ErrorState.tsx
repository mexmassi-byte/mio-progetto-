import { AlertTriangle, WifiOff, ServerCrash, RotateCw, type LucideIcon } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'

export type ErrorKind = 'generic' | 'offline' | 'unavailable'

export interface ErrorStateProps {
  kind?: ErrorKind
  title?: string
  description?: string
  /** Shows a retry button when provided. */
  onRetry?: () => void
  retrying?: boolean
}

const PRESETS: Record<ErrorKind, { icon: LucideIcon; title: string; description: string }> = {
  generic: {
    icon: AlertTriangle,
    title: 'Qualcosa è andato storto',
    description: 'Non è stato possibile caricare questa sezione. Riprova tra qualche istante.',
  },
  offline: {
    icon: WifiOff,
    title: 'Sei offline',
    description:
      'Connessione assente. I dati verranno ricaricati automaticamente al ripristino della rete.',
  },
  unavailable: {
    icon: ServerCrash,
    title: 'Servizio dati non disponibile',
    description:
      'La sorgente dati non risponde al momento. Riprova, oppure continua a consultare i dati già caricati.',
  },
}

/**
 * Failure state for a panel or page. Ready for the real API: an offline
 * variant, a service-unavailable variant and a retry action, so error
 * handling does not need designing when the feed goes live.
 */
export function ErrorState({
  kind = 'generic',
  title,
  description,
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  const preset = PRESETS[kind]
  const Icon = preset.icon
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-base-800 text-signal-amber">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">{title ?? preset.title}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
          {description ?? preset.description}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying} className="mt-1">
          <RotateCw className={retrying ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          {retrying ? 'Nuovo tentativo…' : 'Riprova'}
        </Button>
      )}
    </Card>
  )
}
