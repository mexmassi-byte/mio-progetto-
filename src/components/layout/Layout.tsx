import { useEffect, useState } from 'react'
import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/**
 * App shell: fixed sidebar + sticky topbar, with the routed page
 * rendered into the scrollable main region via <Outlet />.
 */
export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
