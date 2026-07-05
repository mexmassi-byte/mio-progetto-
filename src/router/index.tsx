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
  {
    path: '/',
    element: <Layout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'confronto-piloti', element: <DriverComparison /> },
      { path: 'race-replay', element: <RaceReplay /> },
      { path: 'battle-mode', element: <BattleMode /> },
      { path: 'ai-race-engineer', element: <AIRaceEngineer /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
