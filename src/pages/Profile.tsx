import { useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  User,
  KeyRound,
  LogOut,
  Star,
  Users,
  Dna,
  Sparkles,
  GraduationCap,
  Rewind,
  Activity,
  Heart,
  Flag,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Button,
  Select,
} from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { raceService } from '@/services/raceService'
import { seededRandom } from '@/data/comparison'

const RECENT = [
  { icon: Dna, label: 'Driver DNA', sub: 'Max Verstappen · 2025', to: '/driver-dna', when: '2h fa' },
  { icon: Sparkles, label: 'Predict', sub: 'Italian GP · Wet', to: '/predict', when: '5h fa' },
  { icon: Users, label: 'Driver Comparison', sub: 'VER vs NOR', to: '/confronto-piloti', when: 'ieri' },
  { icon: GraduationCap, label: 'AI Coach', sub: 'Qualifica · Monza', to: '/ai-coach', when: 'ieri' },
  { icon: Rewind, label: 'Race Replay', sub: 'Monaco GP', to: '/race-replay', when: '2g fa' },
]

export function Profile() {
  const { user, logout, updateProfile } = useAuth()

  const drivers = raceService.getDrivers()
  const teams = useMemo(() => [...new Set(drivers.map((d) => d.team))], [drivers])
  const gps = raceService.getGrandsPrix()

  // Deterministic placeholder stats from the account id.
  const stats = useMemo(() => {
    if (!user) return { analyses: 0, favorites: 0, sessions: 0 }
    const rnd = seededRandom(`profile|${user.id}`)
    return {
      analyses: 40 + Math.floor(rnd() * 160),
      favorites: 3 + Math.floor(rnd() * 12),
      sessions: 8 + Math.floor(rnd() * 40),
    }
  }, [user])

  if (!user) return <Navigate to="/login" replace />

  const favDriver = drivers.find((d) => d.id === user.favoriteDriverId)
  const favGp = gps.find((g) => g.id === user.favoriteGpId)
  const initials =
    (user.firstName[0] ?? user.username[0] ?? 'P').toUpperCase() +
    (user.lastName[0] ?? user.username[1] ?? '').toUpperCase()
  const memberSince = new Date(user.createdAt).toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  })
  const hasFullAccess = user.access === 'Full'
  const purchasedOn = user.purchasedAt
    ? new Date(user.purchasedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        icon={User}
        title="Profilo"
        description="Il tuo cockpit personale · impostazioni e attività recenti."
        actions={
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        }
      />

      {/* Identity */}
      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-xl font-bold text-white shadow-glow">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-white">@{user.username}</p>
                <Badge tone={hasFullAccess ? 'amber' : 'neutral'}>
                  {hasFullAccess && <KeyRound className="h-3 w-3" />}
                  {hasFullAccess ? 'Accesso completo' : 'Anteprima'}
                </Badge>
              </div>
              <p className="text-sm text-zinc-500">
                {user.firstName || user.lastName ? `${user.firstName} ${user.lastName} · ` : ''}
                {user.email}
              </p>
              <p className="mt-0.5 text-xs text-zinc-600">
                Membro da {memberSince}
                {purchasedOn ? ` · acquistato il ${purchasedOn}` : ''}
              </p>
            </div>
          </div>
          {!hasFullAccess && (
            <Link to="/get-access">
              <Button size="sm">
                <KeyRound className="h-4 w-4" />
                Sblocca l'accesso
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Activity, label: 'Analisi effettuate', value: stats.analyses },
          { icon: Heart, label: 'Preferiti', value: stats.favorites },
          { icon: Flag, label: 'Sessioni studiate', value: stats.sessions },
        ].map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </div>
              <p className="tabular mt-2 text-2xl font-semibold text-zinc-100">{s.value}</p>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Favorites (editable) */}
        <Card className="lg:col-span-2">
          <CardHeader title="Preferiti" subtitle="Salvati automaticamente" action={<Star className="h-4 w-4 text-signal-amber" />} />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                label="Pilota preferito"
                accent={raceService.driverColors.A}
                options={drivers.map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` }))}
                value={user.favoriteDriverId}
                onChange={(e) => updateProfile({ favoriteDriverId: e.target.value })}
              />
              <Select
                label="Team preferito"
                options={teams.map((t) => ({ value: t, label: t }))}
                value={user.favoriteTeam}
                onChange={(e) => updateProfile({ favoriteTeam: e.target.value })}
              />
              <Select
                label="Gran Premio preferito"
                options={gps.map((g) => ({ value: g.id, label: g.name }))}
                value={user.favoriteGpId}
                onChange={(e) => updateProfile({ favoriteGpId: e.target.value })}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="accent">{favDriver?.name ?? '—'}</Badge>
              <Badge tone="cyan">{user.favoriteTeam}</Badge>
              <Badge tone="neutral">{favGp?.name ?? '—'}</Badge>
            </div>
          </CardBody>
        </Card>

        {/* Recent analyses */}
        <Card>
          <CardHeader title="Ultime analisi" subtitle="Attività recente" />
          <CardBody className="px-0 py-0">
            <ul className="divide-y divide-line">
              {RECENT.map((r) => {
                const Icon = r.icon
                return (
                  <li key={r.label + r.sub}>
                    <Link
                      to={r.to}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-base-850"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-base-800 text-accent-soft">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-200">{r.label}</p>
                        <p className="truncate text-xs text-zinc-600">{r.sub}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-zinc-600">{r.when}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
