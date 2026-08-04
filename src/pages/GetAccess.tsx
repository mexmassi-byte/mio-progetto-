import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Check, ChevronDown, ShieldCheck, Infinity as InfinityIcon, Zap } from 'lucide-react'
import { PageHeader, Card, CardBody, Badge, Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { billingService } from '@/services/billingService'
import { cn } from '@/lib/cn'

/** What preview access already covers vs. what the purchase unlocks. */
const ACCESS_MATRIX: { label: string; preview: boolean }[] = [
  { label: 'Dashboard e classifiche di sessione', preview: true },
  { label: 'Driver Comparison', preview: true },
  { label: 'Race Replay', preview: true },
  { label: 'Driver DNA', preview: false },
  { label: 'Battle Mode', preview: false },
  { label: 'Predict — simulazioni di gara', preview: false },
  { label: 'AI Race Engineer e AI Coach', preview: false },
  { label: 'Confronti multi-stagione', preview: false },
  { label: 'Export dati e report', preview: false },
]

const HIGHLIGHTS = [
  {
    icon: InfinityIcon,
    title: 'Paghi una volta sola',
    desc: 'Nessun rinnovo, nessuna scadenza: l\'accesso resta tuo per sempre.',
  },
  {
    icon: Zap,
    title: 'Tutto sbloccato subito',
    desc: 'Ogni modulo di analisi disponibile dal primo accesso, senza limiti.',
  },
  {
    icon: ShieldCheck,
    title: 'Aggiornamenti inclusi',
    desc: 'Le nuove funzionalità arrivano nel tuo account senza costi extra.',
  },
]

const FAQ = [
  {
    q: 'È un pagamento unico?',
    a: "Sì. ThePaddockView si acquista una volta sola: non ci sono abbonamenti, rinnovi automatici o costi ricorrenti di alcun tipo.",
  },
  {
    q: 'Il pagamento è reale?',
    a: "No. Questa è un'anteprima: nessun pagamento viene elaborato. Il pulsante di acquisto sblocca l'accesso solo a scopo dimostrativo.",
  },
  {
    q: 'Cosa succede dopo l\'acquisto?',
    a: "L'accesso completo viene attivato immediatamente sul tuo account e tutti i moduli diventano disponibili, su ogni dispositivo dove effettui il login.",
  },
  {
    q: 'I dati sono reali?',
    a: 'Sì. Griglia, calendario, classifica e tempi sul giro arrivano da Jolpica-F1 e OpenF1, fonti pubbliche di dati di Formula 1. Le analisi derivate (DNA, Predict, Coach) sono elaborazioni interne calcolate su quei dati.',
  },
]

export function GetAccess() {
  const { user, purchase } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(0)

  const product = billingService.getProduct()
  const hasFullAccess = user?.access === 'Full'

  const onPurchase = async () => {
    if (!user || hasFullAccess) return
    setBusy(true)
    setError('')
    try {
      await purchase()
    } catch {
      setError('Acquisto non riuscito. Riprova.')
    } finally {
      setBusy(false)
    }
  }

  const buttonLabel = hasFullAccess
    ? 'Accesso attivo'
    : !user
      ? 'Accedi per acquistare'
      : busy
        ? 'Attivazione…'
        : 'Acquista accesso'

  return (
    <div className="space-y-6">
      <PageHeader
        icon={KeyRound}
        title="Get Access"
        badge="una tantum"
        description="Sblocca ThePaddockView con un unico acquisto. Nessun abbonamento, nessun rinnovo. Prezzo dimostrativo, nessun pagamento reale."
      />

      {/* Product + purchase */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">{product.name}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                La piattaforma di analisi Formula 1 cockpit-grade: telemetria, confronti
                tra piloti, profili di guida, simulazioni di gara e assistenti AI. Un solo
                acquisto sblocca ogni modulo, per sempre.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {HIGHLIGHTS.map((h) => {
                const Icon = h.icon
                return (
                  <div key={h.title} className="rounded-lg border border-line bg-base-900 p-4">
                    <Icon className="h-5 w-5 text-signal" />
                    <p className="mt-2.5 text-sm font-semibold text-zinc-100">{h.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{h.desc}</p>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>

        {/* Price card */}
        <Card className="relative overflow-hidden" style={{ borderColor: '#fbbf24' }}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-signal-amber/15 blur-3xl" />
          <CardBody className="relative space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-signal-amber">
                <KeyRound className="h-4 w-4" /> Accesso completo
              </span>
              {hasFullAccess && <Badge tone="amber">Attivo</Badge>}
            </div>

            <div>
              <p className="flex items-baseline gap-2">
                <span className="tabular text-4xl font-bold text-white">{product.priceDisplay}</span>
              </p>
              <p className="mt-1 text-sm text-zinc-500">Pagamento unico · accesso permanente</p>
            </div>

            <ul className="space-y-2">
              {product.includes.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-zinc-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-signal-amber" />
                  {item}
                </li>
              ))}
            </ul>

            {error && <p className="text-xs text-accent-soft">{error}</p>}

            {user ? (
              <Button className="w-full" onClick={onPurchase} disabled={busy || hasFullAccess}>
                <KeyRound className="h-4 w-4" />
                {buttonLabel}
              </Button>
            ) : (
              <Link to="/login" className="block">
                <Button className="w-full">
                  <KeyRound className="h-4 w-4" />
                  {buttonLabel}
                </Button>
              </Link>
            )}

            <p className="text-center text-[11px] text-zinc-600">
              Anteprima · nessun pagamento viene elaborato
            </p>
          </CardBody>
        </Card>
      </div>

      {/* What the purchase unlocks */}
      <Card>
        <CardBody className="px-0 py-0">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <span>Funzionalità</span>
            <span className="w-20 text-center">Anteprima</span>
            <span className="w-24 text-center text-signal-amber">Con acquisto</span>
          </div>
          <ul className="divide-y divide-line">
            {ACCESS_MATRIX.map((f) => (
              <li key={f.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3">
                <span className="text-sm text-zinc-300">{f.label}</span>
                <span className="flex w-20 justify-center">
                  {f.preview ? (
                    <Check className="h-4 w-4 text-signal-green" />
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </span>
                <span className="flex w-24 justify-center">
                  <Check className="h-4 w-4 text-signal-amber" />
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
