import { NavLink, Link } from 'react-router-dom'
import { X, Gauge } from 'lucide-react'
import { NAV_ITEMS, NAV_GROUPS } from '@/config/navigation'
import { Badge } from '@/components/ui'
import { raceService } from '@/services/raceService'
import { cn } from '@/lib/cn'

interface SidebarProps {
  /** Mobile drawer open state. */
  open: boolean
  onClose: () => void
}

function BrandMark() {
  // Clicking the brand returns to the standalone landing page.
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
      aria-label="ThePaddockView — vai alla home"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent shadow-glow">
        <Gauge className="h-5 w-5 text-white" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight text-white">
          ThePaddockView
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
          Telemetry
        </p>
      </div>
    </Link>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => {
        const items = NAV_ITEMS.filter((i) => i.group === group.id)
        if (items.length === 0) return null
        return (
          <div key={group.id}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              {group.label}
            </p>
            <ul className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-base-800 text-white'
                            : 'text-zinc-400 hover:bg-base-850 hover:text-zinc-100',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={cn(
                              'flex h-6 w-1 -ml-1 rounded-full transition-colors',
                              isActive ? 'bg-accent' : 'bg-transparent',
                            )}
                          />
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.tag && (
                            <Badge tone="cyan" className="shrink-0">
                              {item.tag}
                            </Badge>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

function SidebarFooter() {
  const user = raceService.getCurrentUser()
  return (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-3 rounded-lg bg-base-850 px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-base-700 text-xs font-semibold text-zinc-300">
          {user.initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-zinc-200">{user.name}</p>
          <p className="truncate text-[10px] text-zinc-600">{user.role}</p>
        </div>
        <span className="h-2 w-2 rounded-full bg-signal-green" />
      </div>
    </div>
  )
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop — fixed rail */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-base-900 lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <BrandMark />
        </div>
        <NavLinks />
        <SidebarFooter />
      </aside>

      {/* Mobile — drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/60 transition-opacity',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={onClose}
        />
        <aside
          className={cn(
            'absolute left-0 top-0 flex h-full w-72 flex-col border-r border-line bg-base-900 transition-transform duration-200',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-line px-5">
            <BrandMark />
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-base-800 hover:text-white"
              aria-label="Chiudi menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <NavLinks onNavigate={onClose} />
          <SidebarFooter />
        </aside>
      </div>
    </>
  )
}
