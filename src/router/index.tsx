import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Home } from '@/pages/Home'
import { Dashboard } from '@/pages/Dashboard'
import { DriverComparison } from '@/pages/DriverComparison'
import { DriverDNA } from '@/pages/DriverDNA'
import { Predict } from '@/pages/Predict'
import { RaceReplay } from '@/pages/RaceReplay'
import { BattleMode } from '@/pages/BattleMode'
import { AIRaceEngineer } from '@/pages/AIRaceEngineer'
import { AICoach } from '@/pages/AICoach'
import { Login } from '@/pages/Login'
import { SignUp } from '@/pages/SignUp'
import { Profile } from '@/pages/Profile'
import { GetAccess } from '@/pages/GetAccess'
import { NotFound } from '@/pages/NotFound'

export const router = createBrowserRouter([
  // Standalone pages — no app shell (sidebar/topbar).
  { path: '/', element: <Home />, errorElement: <NotFound /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <SignUp /> },

  // Application shell wraps every in-product page.
  {
    element: <Layout />,
    errorElement: <NotFound />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'confronto-piloti', element: <DriverComparison /> },
      { path: 'driver-dna', element: <DriverDNA /> },
      { path: 'race-replay', element: <RaceReplay /> },
      { path: 'battle-mode', element: <BattleMode /> },
      { path: 'predict', element: <Predict /> },
      { path: 'ai-race-engineer', element: <AIRaceEngineer /> },
      { path: 'ai-coach', element: <AICoach /> },
      { path: 'profile', element: <Profile /> },
      { path: 'get-access', element: <GetAccess /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
