import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import type { LayoutRoom } from '@/types/database'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'

const FAKE_VENDOR_ID_PREFIX = 'placeholder-'

export interface BoothApplicationRow {
  id: string
  vendor_id: string
  booth_number: number | null
}

export interface PlacedBoothAssignment {
  applicationId: string
  boothNumber: number
  tableLengthFt?: number | null
}

export function isFakeVendorKey(vendorKey: string): boolean {
  return vendorKey.startsWith(FAKE_VENDOR_ID_PREFIX)
}

/** Resolve application for a booth vendor key (vendor_id or legacy application id). */
export function resolveApplicationForVendorKey(
  vendorKey: string,
  applications: readonly BoothApplicationRow[]
): BoothApplicationRow | undefined {
  return (
    applications.find((app) => app.vendor_id === vendorKey) ??
    applications.find((app) => app.id === vendorKey)
  )
}

/**
 * Derive booth_applications.booth_number updates from projected legacy rooms
 * and live HubGrid v2 booth objects. Multi-booth vendors get the lowest number.
 */
export function collectBoothApplicationAssignments(
  projectedRooms: readonly LayoutRoom[],
  boothsById: ReadonlyMap<string, BoothObject>,
  applications: readonly BoothApplicationRow[]
): PlacedBoothAssignment[] {
  const byApplicationId = new Map<string, PlacedBoothAssignment>()

  for (const room of projectedRooms) {
    for (const cell of room.cells ?? []) {
      if (cell.col < 0 || cell.row < 0) continue
      if (cell.tablePurpose === 'guest') continue

      const booth = boothsById.get(cell.id)
      if (!booth || isGuestTableBooth(booth)) continue

      const vendorKey = booth.vendorId
      if (!vendorKey || isFakeVendorKey(vendorKey)) continue

      const app = resolveApplicationForVendorKey(vendorKey, applications)
      if (!app) continue

      const boothNumber = cell.boothNumber
      if (boothNumber == null || boothNumber <= 0) continue

      const existing = byApplicationId.get(app.id)
      if (!existing || boothNumber < existing.boothNumber) {
        byApplicationId.set(app.id, {
          applicationId: app.id,
          boothNumber,
          tableLengthFt: booth.tableLengthFt ?? cell.tableLengthFt ?? null,
        })
      }
    }
  }

  return [...byApplicationId.values()]
}

export interface SyncBoothApplicationNumbersInput {
  eventId: string
  projectedRooms: readonly LayoutRoom[]
  vendorBooths: readonly BoothObject[]
  applications: readonly BoothApplicationRow[]
  eventName?: string
}

export async function syncBoothApplicationNumbers(
  supabase: SupabaseClient,
  input: SyncBoothApplicationNumbersInput
): Promise<{ updated: number; cleared: number }> {
  const boothsById = new Map(input.vendorBooths.map((booth) => [booth.id, booth]))
  const assignments = collectBoothApplicationAssignments(
    input.projectedRooms,
    boothsById,
    input.applications
  )
  const assignedAppIds = new Set(assignments.map((assignment) => assignment.applicationId))
  const previousByAppId = new Map(
    input.applications.map((app) => [app.id, app.booth_number])
  )

  let updated = 0

  for (const assignment of assignments) {
    const previous = previousByAppId.get(assignment.applicationId) ?? null
    if (previous === assignment.boothNumber) continue

    const { error } = await supabase
      .from('booth_applications')
      .update({ booth_number: assignment.boothNumber })
      .eq('id', assignment.applicationId)
      .eq('event_id', input.eventId)

    if (error) throw error
    updated += 1

    const app = input.applications.find((row) => row.id === assignment.applicationId)
    if (
      app?.vendor_id &&
      !isFakeVendorKey(app.vendor_id) &&
      previous !== assignment.boothNumber
    ) {
      const { notifyVendorBoothAssigned } = await import(
        '@/lib/applications/notify-vendor-booth-assigned'
      )
      void notifyVendorBoothAssigned({
        vendorId: app.vendor_id,
        applicationId: app.id,
        eventId: input.eventId,
        eventName: input.eventName ?? 'your market',
        boothNumber: assignment.boothNumber,
      })
    }
  }

  let cleared = 0
  for (const app of input.applications) {
    if (app.booth_number == null) continue
    if (assignedAppIds.has(app.id)) continue

    const { error } = await supabase
      .from('booth_applications')
      .update({ booth_number: null })
      .eq('id', app.id)
      .eq('event_id', input.eventId)

    if (error) throw error
    cleared += 1
  }

  return { updated, cleared }
}
