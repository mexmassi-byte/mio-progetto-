import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Sparkles,
  BarChart3,
  Rocket,
  Bot,
  Activity,
  CheckCheck,
  type LucideIcon,
} from 'lucide-react'
import { raceService } from '@/services/raceService'
import { readPersisted, writePersisted } from '@/lib/usePersistentState'
import type { AppNotification, NotificationKind } from '@/domain/models'
import { cn } from '@/lib/cn'

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  update: Rocket,
  analysis: BarChart3,
  feature: Sparkles,
  ai: Bot,
  system: Activity,
}
const KIND_TONE: Record<NotificationKind, string> = {
  update: 'text-signal',
  analysis: 'text-accent-soft',
  feature: 'text-signal-purple',
  ai: 'text-signal-green',
  system: 'text-zinc-400',
}

const READ_KEY = 'notifications.read'

/**
 * Notification centre. The feed comes from the data layer; which items have
 * been read is persisted locally, so the unread badge behaves like a real
 * product across reloads.
 */
export function NotificationCenter() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<string[]>(() => readPersisted<string[]>(READ_KEY, []))
  const panelRef = useRef<HTMLDivElement>(null)

  const feed = useMemo(() => raceService.getNotifications(), [])
  const items: AppNotification[] = useMemo(
    () => feed.map((n) => ({ ...n, read: n.read || readIds.includes(n.id) })),
    [feed, readIds],
  )
  const unread = items.filter((n) => !n.read).length

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const persistRead = (ids: string[]) => {
    setReadIds(ids)
    writePersisted(READ_KEY, ids)
  }

  const markAllRead = () => persistRead(items.map((n) => n.id))

  const openItem = (n: AppNotification) => {
    if (!readIds.includes(n.id)) persistRead([...readIds, n.id])
    setOpen(false)
    if (n.to) navigate(n.to)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-zinc-400 transition-colors hover:bg-base-800 hover:text-white"
        aria-label={`Notifiche${unread ? ` (${unread} non lette)` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-fade-up overflow-hidden rounded-xl border border-line-strong bg-base-900 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold text-zinc-100">Notifiche</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Segna tutte come lette
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-zinc-500">
                Nessuna notifica.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => {
                  const Icon = KIND_ICON[n.kind]
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => openItem(n)}
                        className={cn(
                          'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-base-850',
                          !n.read && 'bg-base-850/60',
                        )}
                      >
                        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', KIND_TONE[n.kind])} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                'truncate text-sm',
                                n.read ? 'text-zinc-300' : 'font-semibold text-zinc-100',
                              )}
                            >
                              {n.title}
                            </span>
                            {!n.read && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                            {n.body}
                          </span>
                          <span className="mt-1 block text-[10px] text-zinc-600">{n.time}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
