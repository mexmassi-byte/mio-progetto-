import { createContext, useContext, useState, type ReactNode } from 'react'
import { authService } from '@/services/authService'
import type { Account, SignupInput } from '@/domain/models'

interface AuthContextValue {
  user: Account | null
  login: (email: string, password: string) => Promise<Account>
  signup: (input: SignupInput) => Promise<Account>
  logout: () => void
  updateProfile: (patch: Partial<Account>) => Promise<Account>
  upgrade: () => Promise<Account>
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
  const upgrade = async () => {
    const u = await authService.upgrade()
    setUser(u)
    return u
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateProfile, upgrade }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
