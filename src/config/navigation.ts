import {
  LayoutDashboard,
  Users,
  Dna,
  Rewind,
  Swords,
  Sparkles,
  Bot,
  GraduationCap,
  User,
  Crown,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Optional short badge shown in the sidebar (e.g. "beta", "soon"). */
  tag?: string
  /** Optional group heading this item belongs to. */
  group: 'main' | 'analysis' | 'lab' | 'account'
}

/**
 * Single source of truth for the in-app navigation (the pages rendered
 * inside the app shell). The landing page (`/`) lives outside the shell
 * and is reached via the sidebar brand logo, so it is intentionally not
 * listed here.
 * The sidebar and topbar both derive their links/titles from this list.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, group: 'main' },
  {
    label: 'Confronto Piloti',
    to: '/confronto-piloti',
    icon: Users,
    group: 'analysis',
  },
  { label: 'Driver DNA', to: '/driver-dna', icon: Dna, group: 'analysis' },
  { label: 'Race Replay', to: '/race-replay', icon: Rewind, group: 'analysis' },
  { label: 'Battle Mode', to: '/battle-mode', icon: Swords, group: 'analysis' },
  { label: 'Predict', to: '/predict', icon: Sparkles, group: 'analysis' },
  {
    label: 'AI Race Engineer',
    to: '/ai-race-engineer',
    icon: Bot,
    tag: 'beta',
    group: 'lab',
  },
  { label: 'AI Coach', to: '/ai-coach', icon: GraduationCap, tag: 'beta', group: 'lab' },
  { label: 'Profilo', to: '/profile', icon: User, group: 'account' },
  { label: 'Premium', to: '/premium', icon: Crown, group: 'account' },
]

export const NAV_GROUPS: { id: NavItem['group']; label: string }[] = [
  { id: 'main', label: 'Panoramica' },
  { id: 'analysis', label: 'Analisi' },
  { id: 'lab', label: 'Lab' },
  { id: 'account', label: 'Account' },
]
