import { useLocation } from 'react-router-dom'
import { Menu, Search, Bell, Radio } from 'lucide-react'
import { NAV_ITEMS } from '@/config/navigation'
import { Button } from '@/components/ui'

interface TopbarProps {
  onOpenSidebar: () => void
}

function useCurrentTitle(): string {
  const { pathname } = useLocation()
  const match = NAV_ITEMS.find((item) =>
    item.to === '/' ? pathname === '/' : pathname.startsWith(item.to),
  )
  return match?.label ?? 'ThePaddockView'
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
  const title = useCurrentTitle()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-base-950/80 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onOpenSidebar}
        className="rounded-lg p-2 text-zinc-400 hover:bg-base-800 hover:text-white lg:hidden"
        aria-label="Apri menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-zinc-100">{title}</h2>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
          <Radio className="h-3 w-3 text-signal-green" />
          <span>Sessione demo · nessun dato live</span>
        </div>
      </div>

      {/* Search — decorative for now */}
      <div className="ml-auto hidden items-center md:flex">
        <div className="flex h-9 w-64 items-center gap-2 rounded-lg border border-line bg-base-900 px-3 text-sm text-zinc-500">
          <Search className="h-4 w-4" />
          <span>Cerca pilota, gara…</span>
          <kbd className="ml-auto rounded border border-line bg-base-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
            ⌘K
          </kbd>
        </div>
      </div>

      <button
        className="relative rounded-lg p-2 text-zinc-400 hover:bg-base-800 hover:text-white"
        aria-label="Notifiche"
      >
        <Bell className="h-5 w-5" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
      </button>

      <Button size="sm" className="hidden sm:inline-flex">
        Nuova analisi
      </Button>
    </header>
  )
}
