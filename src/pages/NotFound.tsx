import { useNavigate, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { Flag, Home } from 'lucide-react'
import { Button } from '@/components/ui'

export function NotFound() {
  const error = useRouteError()
  const navigate = useNavigate()
  const status = isRouteErrorResponse(error) ? error.status : 404

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-base-800 text-accent-soft">
        <Flag className="h-7 w-7" />
      </div>
      <p className="tabular mt-6 text-5xl font-semibold text-white">{status}</p>
      <h1 className="mt-2 text-lg font-semibold text-zinc-200">
        Pagina fuori pista
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        La rotta richiesta non esiste o è stata spostata. Torna al paddock per
        continuare.
      </p>
      <Button className="mt-6" onClick={() => navigate('/')}>
        <Home className="h-4 w-4" />
        Torna alla Home
      </Button>
    </div>
  )
}
