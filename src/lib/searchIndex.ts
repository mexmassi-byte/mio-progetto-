/**
 * Global search index.
 *
 * Built entirely from the data layer (drivers, teams, grands prix) plus the
 * navigation config, so it stays correct automatically when a real F1 feed
 * replaces the placeholder data — no hardcoded entity lists here.
 */
import { raceService } from '@/services/raceService'
import { NAV_ITEMS } from '@/config/navigation'

export type SearchGroup = 'Piloti' | 'Team' | 'Gran Premi' | 'Pagine'

export interface SearchResult {
  id: string
  group: SearchGroup
  label: string
  sublabel?: string
  /** Route to open. */
  to: string
  /** Persisted selection keys to set before navigating (preselection). */
  preselect?: Record<string, string>
  /** Extra words matched but not displayed (e.g. driver code, circuit). */
  keywords?: string
}

/** Case/accent-insensitive haystack (strips combining diacritics). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function buildSearchIndex(): SearchResult[] {
  const drivers = raceService.getDrivers()
  const grandsPrix = raceService.getGrandsPrix()
  const teams = [...new Set(drivers.map((d) => d.team))]

  const driverEntries: SearchResult[] = drivers.map((d) => ({
    id: `driver:${d.id}`,
    group: 'Piloti',
    label: d.name,
    sublabel: `${d.code} · ${d.team}`,
    to: '/driver-dna',
    preselect: { 'dna.driverA': d.id },
    keywords: `${d.code} ${d.team}`,
  }))

  const teamEntries: SearchResult[] = teams.map((t) => {
    const lineup = drivers.filter((d) => d.team === t).map((d) => d.code)
    return {
      id: `team:${t}`,
      group: 'Team',
      label: t,
      sublabel: lineup.join(' · '),
      to: '/predict',
      preselect: { 'predict.driver': drivers.find((d) => d.team === t)!.id },
      keywords: lineup.join(' '),
    }
  })

  const gpEntries: SearchResult[] = grandsPrix.map((g) => ({
    id: `gp:${g.id}`,
    group: 'Gran Premi',
    label: g.name,
    sublabel: `${g.circuit} · ${g.laps} giri`,
    to: '/dashboard',
    preselect: { 'dashboard.gp': g.id },
    keywords: g.circuit,
  }))

  const pageEntries: SearchResult[] = NAV_ITEMS.map((item) => ({
    id: `page:${item.to}`,
    group: 'Pagine',
    label: item.label,
    sublabel: 'Vai alla pagina',
    to: item.to,
  }))

  return [...pageEntries, ...driverEntries, ...teamEntries, ...gpEntries]
}

/** Ranked filter: prefix matches beat substring matches. */
export function searchIndex(index: SearchResult[], rawQuery: string): SearchResult[] {
  const q = norm(rawQuery.trim())
  if (!q) return index.filter((r) => r.group === 'Pagine')

  const scored = index
    .map((r) => {
      const hay = norm(`${r.label} ${r.sublabel ?? ''} ${r.keywords ?? ''}`)
      const label = norm(r.label)
      if (!hay.includes(q)) return null
      // Lower score sorts first.
      const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2
      return { r, score }
    })
    .filter((x): x is { r: SearchResult; score: number } => x !== null)
    .sort((a, b) => a.score - b.score || a.r.label.localeCompare(b.r.label))

  return scored.map((x) => x.r).slice(0, 12)
}

export const SEARCH_GROUP_ORDER: SearchGroup[] = ['Pagine', 'Piloti', 'Team', 'Gran Premi']
