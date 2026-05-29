import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoothCell, BoothLayout, LayoutRoom } from '@/types/database'

function filterEvictedCells(cells: BoothCell[], removeIds: Set<string>): BoothCell[] {
  return cells.filter((cell) => !removeIds.has(cell.id))
}

function evictFromLayoutRooms(rooms: LayoutRoom[] | undefined, removeIds: Set<string>): LayoutRoom[] {
  if (!rooms?.length) return []
  return rooms.map((room) => ({
    ...room,
    cells: filterEvictedCells(room.cells ?? [], removeIds),
  }))
}

/**
 * Removes a suspended vendor from floor-plan layout data and clears booth_number
 * on their application(s) for the event.
 */
export async function evictVendorFromEventLayout(
  supabase: SupabaseClient,
  eventId: string,
  vendorId: string
): Promise<{ evictedCellCount: number; clearedApplications: number }> {
  const { data: applications } = await supabase
    .from('booth_applications')
    .select('id, booth_number')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)

  const applicationIds = (applications ?? []).map((row) => row.id as string)
  const removeIds = new Set<string>([vendorId, ...applicationIds])

  let evictedCellCount = 0

  const { data: layout } = await supabase
    .from('booth_layouts')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (layout) {
    const row = layout as BoothLayout
    const nextCells = filterEvictedCells(row.cells ?? [], removeIds)
    evictedCellCount += (row.cells?.length ?? 0) - nextCells.length

    const nextRooms = evictFromLayoutRooms(row.layout_rooms, removeIds)
    for (const room of row.layout_rooms ?? []) {
      const updated = nextRooms.find((r) => r.id === room.id)
      evictedCellCount += (room.cells?.length ?? 0) - (updated?.cells.length ?? 0)
    }

    const layoutChanged = evictedCellCount > 0
    if (layoutChanged) {
      await supabase
        .from('booth_layouts')
        .update({
          cells: nextCells,
          ...(nextRooms.length ? { layout_rooms: nextRooms } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId)
    }
  }

  const clearedApplications = applicationIds.length
  if (clearedApplications > 0) {
    await supabase
      .from('booth_applications')
      .update({ booth_number: null, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
  }

  return { evictedCellCount, clearedApplications }
}
