import { Bot, Send, Sparkles, User, Lock } from 'lucide-react'
import {
  PageHeader,
  Card,
  Badge,
  Button,
} from '@/components/ui'
import { cn } from '@/lib/cn'

interface Message {
  role: 'assistant' | 'user'
  text: string
}

// Static scripted transcript — purely illustrative, no logic behind it.
const TRANSCRIPT: Message[] = [
  {
    role: 'user',
    text: 'Conviene anticipare il pit stop di Verstappen?',
  },
  {
    role: 'assistant',
    text: "Con il degrado attuale delle Medium, un undercut al giro 24 offrirebbe circa 1.8s di vantaggio teorico su Norris. L'AI Race Engineer fornirà queste raccomandazioni una volta collegati i dati live.",
  },
  {
    role: 'user',
    text: 'E il rischio traffico in uscita dai box?',
  },
  {
    role: 'assistant',
    text: 'Analisi del traffico non ancora disponibile in questa anteprima. Verrà calcolata dai gap reali dei doppiati.',
  },
]

const SUGGESTIONS = [
  'Analizza il degrado gomme',
  'Confronta le strategie a 1 e 2 soste',
  'Qual è il momento migliore per attaccare?',
  'Riassumi gli ultimi 10 giri',
]

function Bubble({ role, text }: Message) {
  const isAssistant = role === 'assistant'
  return (
    <div
      className={cn(
        'flex gap-3',
        isAssistant ? 'flex-row' : 'flex-row-reverse',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isAssistant
            ? 'bg-accent/15 text-accent-soft'
            : 'bg-base-700 text-zinc-300',
        )}
      >
        {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isAssistant
            ? 'rounded-tl-sm bg-base-800 text-zinc-200'
            : 'rounded-tr-sm bg-base-700 text-zinc-100',
        )}
      >
        {text}
      </div>
    </div>
  )
}

export function AIRaceEngineer() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bot}
        title="AI Race Engineer"
        badge="beta"
        description="Il tuo ingegnere di pista virtuale. Interfaccia dimostrativa — le risposte non sono ancora generate da un modello."
      />

      <Card className="flex h-[540px] flex-col overflow-hidden">
        {/* Conversation header */}
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Sparkles className="h-4 w-4 text-signal-purple" />
          <span className="text-sm font-medium text-zinc-200">Conversazione</span>
          <Badge tone="purple" className="ml-auto">
            <Lock className="h-3 w-3" />
            placeholder
          </Badge>
        </div>

        {/* Transcript */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {TRANSCRIPT.map((m, i) => (
            <Bubble key={i} {...m} />
          ))}
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              disabled
              className="cursor-not-allowed rounded-full border border-line bg-base-850 px-3 py-1.5 text-xs text-zinc-500"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input (disabled) */}
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-base-900 px-3 py-2">
            <input
              disabled
              placeholder="Chiedi qualcosa all'AI Race Engineer… (non attivo in anteprima)"
              className="flex-1 bg-transparent text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none disabled:cursor-not-allowed"
            />
            <Button size="sm" disabled aria-label="Invia">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 px-1 text-[11px] text-zinc-600">
            Modulo AI non ancora collegato · solo interfaccia
          </p>
        </div>
      </Card>
    </div>
  )
}
