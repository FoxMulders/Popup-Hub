'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Wand2, Users } from 'lucide-react'
import { compareFcfsApplicationOrder } from '@/lib/applications/fcfs-sort'
import { hasPriorityQueueAccess } from '@/lib/profile/premium-access'
import { findNeighborPairKeys, isNeighborPair } from '@/lib/booth-planner/neighbor-matches'
import type { BoothApplication, BoothCell } from '@/types/database'

interface FCFSApplication {
  id: string
  vendor_id: string
  applied_at: string
  booth_number: number | null
  requested_booth_type: BoothApplication['requested_booth_type']
  neighbor_preference: string | null
  vendor: { full_name: string; is_beta_tester?: boolean }
  passport: { business_name: string } | null
}

interface FCFSQueueProps {
  applications: FCFSApplication[]
  boothCells: BoothCell[]
  onAssign?: (applicationId: string, boothCellId: string) => void
}

const BOOTH_TYPE_COLORS: Record<string, string> = {
  wall: 'bg-harvest-100 text-harvest-800 border-harvest-300',
  power: 'bg-harvest-50 text-harvest-700 border-harvest-200',
  inside: 'bg-sage-50 text-sage-800 border-sage-200',
  any: 'bg-canvas text-muted-foreground border-stone-200',
}

function boothTypeBadge(type: string | null | undefined) {
  if (!type) return null
  const cls = BOOTH_TYPE_COLORS[type] ?? 'bg-canvas text-muted-foreground border-stone-200'
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${cls}`}>
      {type}
    </span>
  )
}

export function FCFSQueue({ applications, boothCells, onAssign }: FCFSQueueProps) {
  const supabase = createClient()
  const [localApps, setLocalApps] = useState<FCFSApplication[]>(applications)
  const [busy, setBusy] = useState(false)

  // Sort by applied_at (FCFS order)
  const queue = useMemo(
    () =>
      [...localApps].sort((a, b) =>
        compareFcfsApplicationOrder(
          {
            id: a.id,
            appliedAt: a.applied_at,
            priorityBoost: hasPriorityQueueAccess({ is_beta_tester: !!a.vendor.is_beta_tester }),
          },
          {
            id: b.id,
            appliedAt: b.applied_at,
            priorityBoost: hasPriorityQueueAccess({ is_beta_tester: !!b.vendor.is_beta_tester }),
          }
        )
      ),
    [localApps]
  )

  // Cells already assigned (by booth_number) among our apps
  const assignedBoothNumbers = useMemo(
    () => new Set(localApps.filter((a) => a.booth_number != null).map((a) => a.booth_number!)),
    [localApps]
  )

  // Available cells: those whose boothNumber is not yet taken
  const availableCells = useMemo(
    () => boothCells.filter((c) => !assignedBoothNumbers.has(c.boothNumber)),
    [boothCells, assignedBoothNumbers]
  )

  function cellsForType(type: string | null | undefined): BoothCell[] {
    if (!type || type === 'any') return availableCells
    return availableCells.filter((c) => (c.boothType ?? 'inside') === type)
  }

  const neighborPairs = useMemo(() => findNeighborPairKeys(queue), [queue])

  async function assignBooth(appId: string, cellId: string) {
    const cell = boothCells.find((c) => c.id === cellId)
    if (!cell) return

    const { error } = await supabase
      .from('booth_applications')
      .update({ booth_number: cell.boothNumber })
      .eq('id', appId)

    if (error) {
      toast.error('Failed to assign booth')
      return
    }

    setLocalApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, booth_number: cell.boothNumber } : a))
    )
    onAssign?.(appId, cellId)
    toast.success(`Booth #${cell.boothNumber} assigned ✓`)
  }

  async function autoAssignFCFS() {
    setBusy(true)
    const unassigned = queue.filter((a) => a.booth_number == null)
    const tempTaken = new Set(assignedBoothNumbers)
    let assignCount = 0

    for (const app of unassigned) {
      const candidates = cellsForType(app.requested_booth_type).filter(
        (c) => !tempTaken.has(c.boothNumber)
      )
      if (candidates.length === 0) continue

      const cell = candidates[0]
      const { error } = await supabase
        .from('booth_applications')
        .update({ booth_number: cell.boothNumber })
        .eq('id', app.id)

      if (!error) {
        tempTaken.add(cell.boothNumber)
        setLocalApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, booth_number: cell.boothNumber } : a))
        )
        onAssign?.(app.id, cell.id)
        assignCount++
      }
    }

    if (assignCount > 0) {
      toast.success(`Auto-assigned ${assignCount} vendor${assignCount !== 1 ? 's' : ''} ✓`)
    } else {
      toast.info('No available booths matching vendor preferences.')
    }
    setBusy(false)
  }

  const unassignedCount = queue.filter((a) => a.booth_number == null).length

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {unassignedCount} vendor{unassignedCount !== 1 ? 's' : ''} awaiting assignment
          </p>
          <p className="text-xs text-muted-foreground">{availableCells.length} booth{availableCells.length !== 1 ? 's' : ''} available</p>
        </div>
        <Button
          size="sm"
          onClick={autoAssignFCFS}
          disabled={busy || unassignedCount === 0}
          className="gap-1.5 min-h-11"
        >
          <Wand2 className="h-4 w-4" />
          {busy ? 'Assigning…' : 'Auto-Assign FCFS'}
        </Button>
      </div>

      {/* Queue list */}
      <div className="space-y-2">
        {queue.map((app, idx) => {
          const displayName = app.passport?.business_name ?? app.vendor.full_name
          const matchingCells = cellsForType(app.requested_booth_type)
          const neighborApps = queue.filter(
            (other) => other.id !== app.id && isNeighborPair(neighborPairs, app.id, other.id)
          )

          return (
            <div
              key={app.id}
              className={`market-panel p-3 transition-colors ${
                app.booth_number != null ? 'opacity-60' : ''
              } ${neighborApps.length > 0 ? 'border-violet-300 bg-violet-50/30' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Queue position */}
                <div className="shrink-0 h-11 w-11 rounded-full bg-canvas text-foreground flex items-center justify-center text-xs font-bold border-2 border-stone-200">
                  {idx + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading font-semibold text-foreground text-sm">{displayName}</span>
                    {boothTypeBadge(app.requested_booth_type)}
                    {neighborApps.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                        <Users className="h-2.5 w-2.5" />
                        Pair with {neighborApps.map((n) => n.passport?.business_name ?? n.vendor.full_name).join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Applied: {new Date(app.applied_at).toLocaleString()}
                  </p>
                  {app.neighbor_preference && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Neighbor pref: <em>{app.neighbor_preference}</em>
                    </p>
                  )}
                </div>

                {/* Assignment */}
                <div className="shrink-0 flex items-center gap-2">
                  {app.booth_number != null ? (
                    <span className="rounded-lg bg-sage-100 text-sage-800 border border-sage-200 px-2.5 py-1 text-xs font-bold">
                      Booth #{app.booth_number}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) assignBooth(app.id, e.target.value)
                        }}
                        className="min-h-11 rounded-lg border-2 border-stone-200 px-2 py-2 text-base focus:outline-none focus:ring-2 focus:ring-harvest-400 bg-card max-w-[130px]"
                      >
                        <option value="">Assign booth…</option>
                        {matchingCells.map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.boothNumber}{c.boothType ? ` (${c.boothType})` : ''}
                          </option>
                        ))}
                        {matchingCells.length === 0 && (
                          <option disabled>No matching booths</option>
                        )}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {queue.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-stone-200 py-12 text-center bg-canvas/50">
            <p className="text-sm text-muted-foreground">No applications in queue.</p>
          </div>
        )}
      </div>
    </div>
  )
}
