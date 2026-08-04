import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft, ArrowUp, ArrowDown, X } from 'lucide-react'
import {
  buildSearchIndex,
  searchIndex,
  SEARCH_GROUP_ORDER,
  type SearchResult,
} from '@/lib/searchIndex'
import { writePersisted } from '@/lib/usePersistentState'
import { cn } from '@/lib/cn'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

/**
 * Global search (⌘K / Ctrl+K): finds drivers, teams, grands prix, pages and
 * features. Results are grouped and fully keyboard-navigable; choosing an
 * entity preselects it (via the persistence layer) before opening its page.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Index is derived from the data layer; rebuild only when reopened.
  const index = useMemo(() => (open ? buildSearchIndex() : []), [open])
  const results = useMemo(() => searchIndex(index, query), [index, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // Focus after the dialog paints.
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [open])

  useEffect(() => setActive(0), [query])

  // Keep the highlighted row in view while arrowing through results.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (r: SearchResult) => {
    if (r.preselect) {
      for (const [key, value] of Object.entries(r.preselect)) writePersisted(key, value)
    }
    onClose()
    navigate(r.to)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (results.length ? (i + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[active]
      if (r) choose(r)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  // Group while preserving the flat index used for keyboard navigation.
  let cursor = 0
  const grouped = SEARCH_GROUP_ORDER.map((group) => {
    const items = results
      .filter((r) => r.group === group)
      .map((r) => ({ r, idx: cursor++ }))
    return { group, items }
  }).filter((g) => g.items.length > 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Ricerca globale"
    >
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl animate-fade-up overflow-hidden rounded-xl border border-line-strong bg-base-900 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.9)]">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Cerca pilota, team, Gran Premio o pagina…"
            className="h-12 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:text-zinc-200"
            aria-label="Chiudi ricerca"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {grouped.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-zinc-400">Nessun risultato per “{query}”.</p>
              <p className="mt-1 text-xs text-zinc-600">
                Prova con un pilota, un team, un circuito o il nome di una sezione.
              </p>
            </div>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group} className="mb-1">
                <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                  {group}
                </p>
                {items.map(({ r, idx }) => (
                  <button
                    key={r.id}
                    data-idx={idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => choose(r)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                      idx === active ? 'bg-base-800' : 'hover:bg-base-850',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        idx === active ? 'bg-accent' : 'bg-base-600',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-100">{r.label}</span>
                      {r.sublabel && (
                        <span className="block truncate text-xs text-zinc-500">{r.sublabel}</span>
                      )}
                    </span>
                    {idx === active && (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" />
            naviga
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            apri
          </span>
          <span className="ml-auto">esc chiude</span>
        </div>
      </div>
    </div>
  )
}
