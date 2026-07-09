import { Card, Select, SegmentedControl } from '@/components/ui'
import { raceService } from '@/services/raceService'
import type { SessionType } from '@/domain/models'

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
        <SegmentedControl
          label="Sessione"
          options={raceService.getSessions()}
          value={session}
          onChange={onSession}
        />
      </div>
    </Card>
  )
}
