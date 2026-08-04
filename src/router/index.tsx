import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { RouteFallback } from '@/components/layout/RouteFallback'
// The landing is the entry point — keep it in the main chunk so first paint
// needs no extra round-trip. Everything else is code-split.
import { Home } from '@/pages/Home'
import { NotFound } from '@/pages/NotFound'

const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const DriverComparison = lazy(() =>
  import('@/pages/DriverComparison').then((m) => ({ default: m.DriverComparison })),
)
const DriverDNA = lazy(() => import('@/pages/DriverDNA').then((m) => ({ default: m.DriverDNA })))
const RaceReplay = lazy(() => import('@/pages/RaceReplay').then((m) => ({ default: m.RaceReplay })))
const BattleMode = lazy(() => import('@/pages/BattleMode').then((m) => ({ default: m.BattleMode })))
const Predict = lazy(() => import('@/pages/Predict').then((m) => ({ default: m.Predict })))
const AIRaceEngineer = lazy(() =>
  import('@/pages/AIRaceEngineer').then((m) => ({ default: m.AIRaceEngineer })),
)
const AICoach = lazy(() => import('@/pages/AICoach').then((m) => ({ default: m.AICoach })))
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })))
const GetAccess = lazy(() => import('@/pages/GetAccess').then((m) => ({ default: m.GetAccess })))
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })))
const SignUp = lazy(() => import('@/pages/SignUp').then((m) => ({ default: m.SignUp })))

/** Wraps a lazily-loaded page in a skeleton fallback. */
const page = (node: ReactNode) => <Suspense fallback={<RouteFallback />}>{node}</Suspense>

export const router = createBrowserRouter([
  // Standalone pages — no app shell (sidebar/topbar).
  { path: '/', element: <Home />, errorElement: <NotFound /> },
  { path: '/login', element: page(<Login />) },
  { path: '/signup', element: page(<SignUp />) },

  // Application shell wraps every in-product page.
  {
    element: <Layout />,
    errorElement: <NotFound />,
    children: [
      { path: 'dashboard', element: page(<Dashboard />) },
      { path: 'confronto-piloti', element: page(<DriverComparison />) },
      { path: 'driver-dna', element: page(<DriverDNA />) },
      { path: 'race-replay', element: page(<RaceReplay />) },
      { path: 'battle-mode', element: page(<BattleMode />) },
      { path: 'predict', element: page(<Predict />) },
      { path: 'ai-race-engineer', element: page(<AIRaceEngineer />) },
      { path: 'ai-coach', element: page(<AICoach />) },
      { path: 'profile', element: page(<Profile />) },
      { path: 'get-access', element: page(<GetAccess />) },
      { path: '*', element: <NotFound /> },
    ],
  },
])
