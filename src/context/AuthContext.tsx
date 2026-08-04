import { createContext, useContext, useState, type ReactNode } from 'react'
import { authService } from '@/services/authService'
import { billingService } from '@/services/billingService'
import type { Account, SignupInput } from '@/domain/models'

interface AuthContextValue {
  user: Account | null
  login: (email: string, password: string) => Promise<Account>
  signup: (input: SignupInput) => Promise<Account>
  logout: () => void
  updateProfile: (patch: Partial<Account>) => Promise<Account>
  /** Runs the one-time checkout and unlocks full access. */
  purchase: () => Promise<Account>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * App-wide auth state. Wraps the placeholder `authService` and exposes the
 * current user + actions. Swapping the service for a real API needs no change
 * here or in the components.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(() => authService.getCurrentUser())

  const login = async (email: string, password: string) => {
    const u = await authService.login(email, password)
    setUser(u)
    return u
  }
  const signup = async (input: SignupInput) => {
    const u = await authService.signup(input)
    setUser(u)
    return u
  }
  const logout = () => {
    authService.logout()
    setUser(null)
  }
  const updateProfile = async (patch: Partial<Account>) => {
    const u = await authService.updateProfile(patch)
    setUser(u)
    return u
  }
  const purchase = async () => {
    // With a real provider this returns a redirectUrl and the page navigates
    // to the hosted checkout; the webhook then flips the account server-side.
    const result = await billingService.createCheckout()
    if (result.status !== 'completed') throw new Error('Checkout non completato')
    const u = await authService.grantFullAccess()
    setUser(u)
    return u
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateProfile, purchase }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
