import { useState } from 'react'
import { Crown, Check, Minus, ChevronDown, Sparkles } from 'lucide-react'
import { PageHeader, Card, CardBody, Badge, Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/cn'

const FEATURES: { label: string; free: boolean; premium: boolean }[] = [
  { label: 'Dashboard e leaderboard', free: true, premium: true },
  { label: 'Driver Comparison', free: true, premium: true },
  { label: 'Race Replay', free: true, premium: true },
  { label: 'Driver DNA', free: true, premium: true },
  { label: 'Battle Mode', free: false, premium: true },
  { label: 'Predict — simulazioni illimitate', free: false, premium: true },
  { label: 'AI Race Engineer & AI Coach', free: false, premium: true },
  { label: 'Confronti multi-stagione', free: false, premium: true },
  { label: 'Export dati e report', free: false, premium: true },
]

const FAQ = [
  {
    q: 'Il pagamento è reale?',
    a: 'No. Questa è un\'anteprima: nessun pagamento viene elaborato. Il pulsante Upgrade attiva il piano Premium solo a scopo dimostrativo.',
  },
  {
    q: 'Posso annullare quando voglio?',
    a: 'Sì. Nella versione finale il piano sarà mensile e disdicibile in qualsiasi momento, senza vincoli.',
  },
  {
    q: 'I dati sono reali?',
    a: 'Non ancora. I valori mostrati sono segnaposto coerenti; l\'architettura è già pronta per collegare dati di Formula 1 reali.',
  },
  {
    q: 'Cosa ottengo con Premium?',
    a: 'Accesso completo a Predict, Battle Mode, agli assistenti AI e ai confronti multi-stagione, oltre all\'export di dati e report.',
  },
]

function FeatureIcon({ on }: { on: boolean }) {
  return on ? (
    <Check className="h-4 w-4 text-signal-green" />
  ) : (
    <Minus className="h-4 w-4 text-zinc-600" />
  )
}

export function Premium() {
  const { user, upgrade } = useAuth()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<number | null>(0)
  const isPremium = user?.plan === 'Premium'

  const onUpgrade = async () => {
    if (!user || isPremium) return
    setBusy(true)
    try {
      await upgrade()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Crown}
        title="Premium"
        badge="upgrade"
        description="Sblocca tutta la potenza di ThePaddockView. Prezzi dimostrativi, nessun pagamento reale."
      />

      {/* Pricing cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Free</span>
            {!isPremium && <Badge tone="neutral">Piano attuale</Badge>}
          </div>
          <p className="mt-4 flex items-baseline gap-1">
            <span className="tabular text-3xl font-bold text-white">€0</span>
            <span className="text-sm text-zinc-500">/ mese</span>
          </p>
          <p className="mt-2 text-sm text-zinc-500">Le basi per iniziare ad analizzare.</p>
          <ul className="mt-5 space-y-2">
            {FEATURES.filter((f) => f.free).map((f) => (
              <li key={f.label} className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="h-4 w-4 text-signal-green" />
                {f.label}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="relative overflow-hidden p-6" style={{ borderColor: '#fbbf24' }}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-signal-amber/15 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-signal-amber">
              <Crown className="h-4 w-4" /> Premium
            </span>
            {isPremium ? <Badge tone="amber">Piano attivo</Badge> : <Badge tone="amber">Consigliato</Badge>}
          </div>
          <p className="relative mt-4 flex items-baseline gap-1">
            <span className="tabular text-3xl font-bold text-white">€9,99</span>
            <span className="text-sm text-zinc-500">/ mese</span>
          </p>
          <p className="relative mt-2 text-sm text-zinc-500">Tutto sbloccato, senza limiti.</p>
          <ul className="relative mt-5 space-y-2">
            {FEATURES.filter((f) => f.premium).map((f) => (
              <li key={f.label} className="flex items-center gap-2 text-sm text-zinc-300">
                <Check className="h-4 w-4 text-signal-amber" />
                {f.label}
              </li>
            ))}
          </ul>
          <Button
            className="relative mt-6 w-full"
            onClick={onUpgrade}
            disabled={busy || isPremium || !user}
          >
            <Sparkles className="h-4 w-4" />
            {isPremium ? 'Premium attivo' : !user ? 'Accedi per fare upgrade' : busy ? 'Attivazione…' : 'Passa a Premium'}
          </Button>
        </Card>
      </div>

      {/* Comparison table */}
      <Card>
        <CardBody className="px-0 py-0">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <span>Funzionalità</span>
            <span className="w-14 text-center">Free</span>
            <span className="w-16 text-center text-signal-amber">Premium</span>
          </div>
          <ul className="divide-y divide-line">
            {FEATURES.map((f) => (
              <li key={f.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3">
                <span className="text-sm text-zinc-300">{f.label}</span>
                <span className="flex w-14 justify-center">
                  <FeatureIcon on={f.free} />
                </span>
                <span className="flex w-16 justify-center">
                  <FeatureIcon on={f.premium} />
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* FAQ */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">FAQ</h2>
        <div className="space-y-2">
          {FAQ.map((item, i) => {
            const isOpen = open === i
            return (
              <Card key={item.q} className="overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-medium text-zinc-200">{item.q}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-zinc-500 transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                {isOpen && (
                  <p className="animate-fade-up px-5 pb-4 text-sm leading-relaxed text-zinc-400">
                    {item.a}
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
