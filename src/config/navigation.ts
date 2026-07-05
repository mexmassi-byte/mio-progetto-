import {
  LayoutDashboard,
  Home,
  Users,
  Rewind,
  Swords,
  Bot,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Optional short badge shown in the sidebar (e.g. "beta", "soon"). */
  tag?: string
  /** Optional group heading this item belongs to. */
  group: 'main' | 'analysis' | 'lab'
}

/**
 * Single source of truth for the app navigation.
 * The sidebar, topbar and router all derive their links from here.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/', icon: Home, group: 'main' },
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, group: 'main' },
  {
    label: 'Confronto Piloti',
    to: '/confronto-piloti',
    icon: Users,
    group: 'analysis',
  },
  { label: 'Race Replay', to: '/race-replay', icon: Rewind, group: 'analysis' },
  { label: 'Battle Mode', to: '/battle-mode', icon: Swords, group: 'analysis' },
  {
    label: 'AI Race Engineer',
    to: '/ai-race-engineer',
    icon: Bot,
    tag: 'beta',
    group: 'lab',
  },
]

export const NAV_GROUPS: { id: NavItem['group']; label: string }[] = [
  { id: 'main', label: 'Panoramica' },
  { id: 'analysis', label: 'Analisi' },
  { id: 'lab', label: 'Lab' },
]
