import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Mail, Lock, Gauge, ArrowRight } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Shared full-screen shell for the auth pages (matches the landing style). */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-base-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:38px_38px]" />
      <div className="pointer-events-none absolute left-1/2 top-[-20%] h-[440px] w-[720px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px] animate-glow-pulse" />
      <Link to="/" className="relative z-10 mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent shadow-glow">
          <Gauge className="h-5 w-5 text-white" />
        </div>
        <span className="text-base font-semibold tracking-tight text-white">ThePaddockView</span>
      </Link>
      <div className="relative z-10 w-full max-w-sm animate-fade-up">{children}</div>
    </div>
  )
}

export function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/profile" replace />

  const submit = async () => {
    const next: typeof errors = {}
    if (!EMAIL_RE.test(email)) next.email = 'Inserisci un indirizzo email valido.'
    if (password.length < 6) next.password = 'La password deve avere almeno 6 caratteri.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await login(email, password)
      navigate('/profile')
    } catch {
      setErrors({ form: 'Accesso non riuscito. Riprova.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <div className="rounded-2xl border border-line bg-base-900/80 p-6 shadow-panel backdrop-blur-sm">
        <h1 className="text-lg font-semibold text-white">Bentornato</h1>
        <p className="mt-1 text-sm text-zinc-500">Accedi al tuo cockpit ThePaddockView.</p>

        <div className="mt-6 space-y-4">
          <Input
            label="Email"
            icon={Mail}
            type="email"
            placeholder="tu@esempio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <Input
            label="Password"
            icon={Lock}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-line bg-base-800 accent-accent"
              />
              Ricordami
            </label>
            <button
              type="button"
              onClick={() => setInfo('Recupero password non disponibile in anteprima.')}
              className="text-xs font-medium text-zinc-400 transition-colors hover:text-accent-soft"
            >
              Password dimenticata?
            </button>
          </div>

          {info && <p className="text-xs text-signal-amber">{info}</p>}
          {errors.form && <p className="text-xs text-accent-soft">{errors.form}</p>}

          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? 'Accesso…' : 'Accedi'}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-600">
          <span className="h-px flex-1 bg-line" /> oppure <span className="h-px flex-1 bg-line" />
        </div>

        <Link to="/signup">
          <Button variant="outline" className="w-full">
            Crea un account
          </Button>
        </Link>
      </div>
      <p className="mt-4 text-center text-[11px] text-zinc-600">
        Anteprima · autenticazione simulata, nessun backend reale
      </p>
    </AuthShell>
  )
}
