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
import type { Account, SignupInput } from '@/domain/models'

const STORAGE_KEY = 'tpv_account'

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function read(): Account | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

function write(account: Account | null): void {
  try {
    if (account) localStorage.setItem(STORAGE_KEY, JSON.stringify(account))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore storage errors */
  }
}

/** Simulate a short network round-trip. */
function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

const DEFAULT_FAVORITES = {
  favoriteDriverId: 'ver',
  favoriteTeam: 'Red Bull Racing',
  favoriteGpId: 'ita',
}

export const authService = {
  getCurrentUser: (): Account | null => read(),

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
            ...DEFAULT_FAVORITES,
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
      ...DEFAULT_FAVORITES,
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
