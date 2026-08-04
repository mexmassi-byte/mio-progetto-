/**
 * authService — placeholder authentication (no real backend).
 *
 * Mirrors the data-layer pattern: the app talks only to this service, so it
 * can be swapped for a real auth API without touching the UI. Sessions are
 * persisted to localStorage; methods are async to match a future HTTP flow.
 *
 * To go live: replace the localStorage read/write with real requests
 * (login/signup return a token + profile; getCurrentUser reads the cached
 * session). The component layer stays the same.
 */
import { raceService } from './raceService'
import type {
  Account,
  ProfileStats,
  RecentAnalysis,
  SignupInput,
} from '@/domain/models'

const STORAGE_KEY = 'tpv_account'

/**
 * Tamper-evidence for the locally stored account.
 *
 * ⚠️ This is NOT security: with the whole app running client-side, anyone can
 * recompute the checksum. It only makes casual edits of localStorage (e.g.
 * flipping `access` to 'Full') fail loudly instead of silently granting paid
 * features. Real entitlement checks MUST move server-side — the payment
 * webhook is the source of truth, not the browser.
 */
function checksum(account: Omit<Account, 'sig'> & Record<string, unknown>): string {
  const payload = `${account.id}|${account.email}|${account.access}|${account.purchasedAt ?? ''}`
  let h = 2166136261
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function read(): Account | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Account & { sig?: string }

    // Reject structurally invalid sessions.
    if (typeof parsed?.id !== 'string' || typeof parsed?.email !== 'string') return null
    if (parsed.access !== 'Preview' && parsed.access !== 'Full') return null

    // Tamper check: a hand-edited entitlement drops back to preview access.
    const { sig, ...rest } = parsed
    if (sig !== checksum(rest as never)) {
      const downgraded: Account = { ...(rest as Account), access: 'Preview', purchasedAt: undefined }
      write(downgraded)
      return downgraded
    }
    return rest as Account
  } catch {
    return null
  }
}

function write(account: Account | null): void {
  try {
    if (account)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...account, sig: checksum(account as never) }),
      )
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore storage errors */
  }
}

/** Simulate a short network round-trip. */
function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/**
 * Seeds a new account's favourites from whatever grid/calendar is live, so a
 * profile never points at entities that do not exist in the current season.
 */
function defaultFavorites() {
  const driver = raceService.getDrivers()[0]
  const gp = raceService.getGrandsPrix()[0]
  return {
    favoriteDriverId: driver?.id ?? '',
    favoriteTeam: driver?.team ?? '',
    favoriteGpId: gp?.id ?? '',
  }
}

/** Deterministic pseudo-random from a string seed (account-scoped stats). */
function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Placeholder activity feed — a real backend would serve this per account. */
const RECENT: RecentAnalysis[] = [
  { id: 'r1', label: 'Driver DNA', detail: 'Profilo stile di guida', to: '/driver-dna', when: '2h fa' },
  { id: 'r2', label: 'Predict', detail: 'Simulazione di gara', to: '/predict', when: '5h fa' },
  { id: 'r3', label: 'Driver Comparison', detail: 'Confronto testa a testa', to: '/confronto-piloti', when: 'ieri' },
  { id: 'r4', label: 'AI Coach', detail: 'Analisi sessione', to: '/ai-coach', when: 'ieri' },
  { id: 'r5', label: 'Race Replay', detail: 'Replay della gara', to: '/race-replay', when: '2g fa' },
]

export const authService = {
  getCurrentUser: (): Account | null => read(),

  /** Usage stats for the profile — deterministic per account. */
  getProfileStats: (accountId: string): ProfileStats => {
    const rnd = seeded(`profile|${accountId}`)
    return {
      analyses: 40 + Math.floor(rnd() * 160),
      favorites: 3 + Math.floor(rnd() * 12),
      sessions: 8 + Math.floor(rnd() * 40),
    }
  },

  getRecentAnalyses: (): RecentAnalysis[] => RECENT,

  /** Placeholder login: accepts any valid credentials. */
  login: async (email: string, _password: string): Promise<Account> => {
    const existing = read()
    const account: Account =
      existing && existing.email === email
        ? existing
        : {
            id: genId(),
            firstName: '',
            lastName: '',
            username: email.split('@')[0] || 'pilota',
            email,
            access: 'Preview',
            ...defaultFavorites(),
            createdAt: new Date().toISOString(),
          }
    write(account)
    return delay(account)
  },

  signup: async (input: SignupInput): Promise<Account> => {
    const account: Account = {
      id: genId(),
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      email: input.email,
      access: 'Preview',
      ...defaultFavorites(),
      createdAt: new Date().toISOString(),
    }
    write(account)
    return delay(account)
  },

  logout: (): void => write(null),

  updateProfile: async (patch: Partial<Account>): Promise<Account> => {
    const current = read()
    if (!current) throw new Error('Not authenticated')
    const next = { ...current, ...patch }
    write(next)
    return delay(next, 200)
  },

  /**
   * Grants full access after a completed one-time purchase. With a real
   * backend this is not called by the client: the payment provider's webhook
   * flips the account server-side and this reduces to re-reading the profile.
   */
  grantFullAccess: async (): Promise<Account> => {
    const current = read()
    if (!current) throw new Error('Not authenticated')
    const next: Account = {
      ...current,
      access: 'Full',
      purchasedAt: new Date().toISOString(),
    }
    write(next)
    return delay(next)
  },
}
