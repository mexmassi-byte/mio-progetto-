import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { router } from '@/router'
import { bootstrap, dataSourceName } from '@/services/raceService'
import './index.css'

// Kick off the real-data load before first paint; every getter falls back to
// placeholder data until it resolves, so rendering never waits on the network.
if (dataSourceName === 'api') void bootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
