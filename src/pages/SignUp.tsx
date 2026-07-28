import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { User, AtSign, Mail, Lock, ArrowRight } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { AuthShell } from './Login'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Fields {
  firstName: string
  lastName: string
  username: string
  email: string
  password: string
  confirm: string
}

const EMPTY: Fields = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  password: '',
  confirm: '',
}

export function SignUp() {
  const { user, signup } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState<Fields>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Fields | 'form', string>>>({})
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/profile" replace />

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((prev) => ({ ...prev, [key]: e.target.value }))

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!f.firstName.trim()) next.firstName = 'Obbligatorio'
    if (!f.lastName.trim()) next.lastName = 'Obbligatorio'
    if (f.username.trim().length < 3) next.username = 'Almeno 3 caratteri'
    if (!EMAIL_RE.test(f.email)) next.email = 'Email non valida'
    if (f.password.length < 6) next.password = 'Almeno 6 caratteri'
    if (f.confirm !== f.password) next.confirm = 'Le password non coincidono'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setBusy(true)
    try {
      await signup({
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        username: f.username.trim(),
        email: f.email.trim(),
        password: f.password,
      })
      navigate('/profile')
    } catch {
      setErrors({ form: 'Registrazione non riuscita. Riprova.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <div className="rounded-2xl border border-line bg-base-900/80 p-6 shadow-panel backdrop-blur-sm">
        <h1 className="text-lg font-semibold text-white">Crea il tuo account</h1>
        <p className="mt-1 text-sm text-zinc-500">Entra nel paddock in meno di un minuto.</p>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome" icon={User} placeholder="Max" value={f.firstName} onChange={set('firstName')} error={errors.firstName} />
            <Input label="Cognome" placeholder="Verstappen" value={f.lastName} onChange={set('lastName')} error={errors.lastName} />
          </div>
          <Input label="Username" icon={AtSign} placeholder="maxv" value={f.username} onChange={set('username')} error={errors.username} />
          <Input label="Email" icon={Mail} type="email" placeholder="tu@esempio.com" value={f.email} onChange={set('email')} error={errors.email} />
          <Input label="Password" icon={Lock} type="password" placeholder="••••••••" value={f.password} onChange={set('password')} error={errors.password} />
          <Input label="Conferma password" icon={Lock} type="password" placeholder="••••••••" value={f.confirm} onChange={set('confirm')} error={errors.confirm} onKeyDown={(e) => e.key === 'Enter' && submit()} />

          {errors.form && <p className="text-xs text-accent-soft">{errors.form}</p>}

          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? 'Creazione…' : 'Registrati'}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>

        <p className="mt-5 text-center text-xs text-zinc-500">
          Hai già un account?{' '}
          <Link to="/login" className="font-medium text-accent-soft hover:underline">
            Accedi
          </Link>
        </p>
      </div>
      <p className="mt-4 text-center text-[11px] text-zinc-600">
        Anteprima · validazione lato client, nessun backend reale
      </p>
    </AuthShell>
  )
}
