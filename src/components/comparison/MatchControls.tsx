import { Card, Select } from '@/components/ui'
import { raceService } from '@/services/raceService'
import type { SessionType } from '@/domain/models'
import { cn } from '@/lib/cn'

const DRIVER_COLORS = raceService.driverColors

export interface MatchControlsProps {
  driverAId: string
  driverBId: string
  gpId: string
  session: SessionType
  onDriverA: (id: string) => void
  onDriverB: (id: string) => void
  onGp: (id: string) => void
  onSession: (s: SessionType) => void
}

/**
 * Shared selection controls for the two-driver pages (Driver Comparison,
 * Battle Mode): two independent driver menus, a grand prix menu and a
 * session toggle. The same driver can never be picked on both sides —
 * the option is disabled and the change handler ignores an equal pick.
 *
 * Driver / GP / session lists come from the mock data layer, so wiring
 * real data later means changing only `@/data/comparison`.
 */
export function MatchControls({
  driverAId,
  driverBId,
  gpId,
  session,
  onDriverA,
  onDriverB,
  onGp,
  onSession,
}: MatchControlsProps) {
  const driverOptionsExcept = (otherId: string) =>
    raceService.getDrivers().map((d) => ({
      value: d.id,
      label: `${d.code} · ${d.name}`,
      disabled: d.id === otherId,
    }))
  const gpOptions = raceService.getGrandsPrix().map((g) => ({
    value: g.id,
    label: `${g.name} — ${g.circuit}`,
  }))

  return (
    <Card className="p-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Select
          label="Driver A"
          accent={DRIVER_COLORS.A}
          options={driverOptionsExcept(driverBId)}
          value={driverAId}
          onChange={(e) => e.target.value !== driverBId && onDriverA(e.target.value)}
        />
        <Select
          label="Driver B"
          accent={DRIVER_COLORS.B}
          options={driverOptionsExcept(driverAId)}
          value={driverBId}
          onChange={(e) => e.target.value !== driverAId && onDriverB(e.target.value)}
        />
        <Select
          label="Gran Premio"
          options={gpOptions}
          value={gpId}
          onChange={(e) => onGp(e.target.value)}
        />
        <div>
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Sessione
          </span>
          <div className="flex rounded-lg border border-line bg-base-900 p-0.5">
            {raceService.getSessions().map((s) => (
              <button
                key={s}
                onClick={() => onSession(s)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  session === s
                    ? 'bg-base-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
