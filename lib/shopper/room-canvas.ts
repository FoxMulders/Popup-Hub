import { resolveGridConfig } from '@/lib/booth-planner/grid-config'
import { resolveVenueElementsForCanvas } from '@/lib/booth-planner/resolve-venue-elements'
import { canvasRowsWithAnnex } from '@/lib/booth-planner/off-floor-zones'
import { getOffFloorZonesForPreset } from '@/lib/booth-planner/venue-presets'
import type { BoothCell, LayoutRoom } from '@/types/database'

export interface RoomCanvasMetrics {
  cols: number
  hallRows: number
  canvasRows: number
  cellWidthFt: number
  cellLengthFt: number
  venueElements: ReturnType<typeof resolveVenueElementsForCanvas>
  placedCells: BoothCell[]
}

/** Responsive 1′ cell size for mobile floor-plan panes (6–16 px). */
export function responsiveCellPx(containerWidth: number, cols: number, canvasRows: number): number {
  const safeWidth = Math.max(280, containerWidth - 16)
  const byWidth = Math.floor(safeWidth / cols)
  const byHeight = Math.floor(420 / canvasRows)
  return Math.max(6, Math.min(16, Math.min(byWidth, byHeight)))
}

export function getRoomCanvasMetrics(room: LayoutRoom): RoomCanvasMetrics {
  const gridConfig = resolveGridConfig({
    venueWidthFt: room.venue_width,
    venueLengthFt: room.venue_length,
    boothWidthFt: room.booth_width,
    boothLengthFt: room.booth_length,
    spacingMode: room.spacing_mode ?? 'one_foot',
  })

  const cols = gridConfig.cols
  const hallRows = gridConfig.rows
  const annexZones = getOffFloorZonesForPreset(room.venue_preset_id)
  let canvasRows =
    annexZones.length > 0 ? canvasRowsWithAnnex(hallRows, annexZones) : hallRows

  for (const el of room.venue_elements ?? []) {
    canvasRows = Math.max(canvasRows, el.row + (el.rowSpan ?? 1))
  }
  for (const cell of room.cells ?? []) {
    if (cell.col >= 0 && cell.row >= 0) {
      canvasRows = Math.max(canvasRows, cell.row + cell.rowSpan)
    }
  }

  const venueElements = resolveVenueElementsForCanvas(
    room.venue_elements ?? [],
    room.entrance,
    cols,
    hallRows
  )

  const placedCells = (room.cells ?? []).filter((c) => c.col >= 0 && c.row >= 0)

  return {
    cols,
    hallRows,
    canvasRows,
    cellWidthFt: gridConfig.cellWidthFt,
    cellLengthFt: gridConfig.cellLengthFt,
    venueElements,
    placedCells,
  }
}
