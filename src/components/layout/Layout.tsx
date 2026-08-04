import { useEffect, useState } from 'react'
import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/lib/useOnlineStatus'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/**
 * App shell: fixed sidebar + sticky topbar, with the routed page
 * rendered into the scrollable main region via <Outlet />.
 */
export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const online = useOnlineStatus()
  const { pathname } = useLocation()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-base-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        {!online && (
          <div className="flex items-center justify-center gap-2 border-b border-signal-amber/30 bg-signal-amber/10 px-4 py-2 text-xs text-signal-amber">
            <WifiOff className="h-3.5 w-3.5" />
            Sei offline — i dati mostrati potrebbero non essere aggiornati.
          </div>
        )}
        <main className="flex-1 overflow-y-auto bg-grid-faint [background-size:32px_32px]">
          {/* Keyed on the route so each navigation replays a light enter
              animation — a smooth page transition without a router library. */}
          <div
            key={pathname}
            className="mx-auto w-full max-w-7xl animate-page-in px-4 py-6 sm:px-6 lg:px-8"
          >
            <Outlet />
          </div>
        </main>
      </div>

      <ScrollRestoration />
    </div>
  )
}
