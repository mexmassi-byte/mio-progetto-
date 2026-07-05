import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Home } from '@/pages/Home'
import { Dashboard } from '@/pages/Dashboard'
import { DriverComparison } from '@/pages/DriverComparison'
import { RaceReplay } from '@/pages/RaceReplay'
import { BattleMode } from '@/pages/BattleMode'
import { AIRaceEngineer } from '@/pages/AIRaceEngineer'
import { NotFound } from '@/pages/NotFound'

export const router = createBrowserRouter([
  // Standalone premium landing — no app shell (sidebar/topbar).
  { path: '/', element: <Home />, errorElement: <NotFound /> },

  // Application shell wraps every in-product page.
  {
    element: <Layout />,
    errorElement: <NotFound />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'confronto-piloti', element: <DriverComparison /> },
      { path: 'race-replay', element: <RaceReplay /> },
      { path: 'battle-mode', element: <BattleMode /> },
      { path: 'ai-race-engineer', element: <AIRaceEngineer /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
