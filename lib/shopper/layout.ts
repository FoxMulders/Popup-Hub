import { analyzeStrollerClearance } from '@/lib/booth-planner/stroller-clearance'
import { resolveGridConfig } from '@/lib/booth-planner/grid-config'
import {
  computePatronPathTrace,
  patronPathFlowVectorAt,
  type PatronPathPoint,
  type PatronPathTrace,
} from '@/lib/booth-planner/patron-path-trace'
import {
  computeExpositionTourRoute,
  computeVendorDirectRoute,
  type ShopperRouteMode,
} from '@/lib/shopper/pathfinding'
import {
  getRoomCanvasMetrics,
  responsiveCellPx,
  type RoomCanvasMetrics,
} from '@/lib/shopper/room-canvas'
import type { BoothCell, BoothLayout, LayoutRoom } from '@/types/database'

export type { PatronPathTrace, PatronPathPoint, RoomCanvasMetrics, ShopperRouteMode }
export { responsiveCellPx, getRoomCanvasMetrics }

export type StrollerBadge = 'friendly' | 'caution' | 'unknown'

/** Patron route from entrance through aisles toward the raised stage annex (falls back to exit). */
export function computeShopperPatronPath(room: LayoutRoom): PatronPathTrace | null {
  const metrics = getRoomCanvasMetrics(room)
  return computePatronPathTrace(
    metrics.venueElements,
    metrics.cols,
    metrics.canvasRows,
    room.entrance,
    {
      placedCells: metrics.placedCells,
      destination: 'stage',
    }
  )
}

/** Short spur from the main patron path to a selected booth (legacy — prefer computeVendorDirectRoute). */
export function computeBoothSpurPath(
  room: LayoutRoom,
  _mainTrace: PatronPathTrace,
  booth: BoothCell
): PatronPathTrace | null {
  return computeVendorDirectRoute(room, booth)
}

/** Option A — A* route from entrance to a vendor booth. */
export { computeVendorDirectRoute } from '@/lib/shopper/pathfinding'

/** Option B — TSP-style exposition tour covering all booth approach nodes. */
export { computeExpositionTourRoute } from '@/lib/shopper/pathfinding'

/** Resolve active route trace for the selected routing mode. */
export function resolveShopperRouteTrace(
  room: LayoutRoom,
  mode: ShopperRouteMode,
  selectedBooth: BoothCell | null
): PatronPathTrace | null {
  switch (mode) {
    case 'baseline':
      return computeShopperPatronPath(room)
    case 'vendor':
      return selectedBooth ? computeVendorDirectRoute(room, selectedBooth) : null
    case 'exposition':
      return computeExpositionTourRoute(room)
    default:
      return null
  }
}

/** Flow direction at a booth cell (for subtle mobile direction hint). */
export function patronFlowHintAtBooth(
  booth: BoothCell,
  trace: PatronPathTrace
): { dr: number; dc: number } | null {
  const centerRow = booth.row + booth.rowSpan / 2
  const centerCol = booth.col + booth.colSpan / 2
  return patronPathFlowVectorAt(Math.floor(centerRow), Math.floor(centerCol), trace)
}

export function getStrollerBadge(layout: BoothLayout | null): StrollerBadge {
  if (!layout) return 'unknown'
  const rooms = getLayoutRooms(layout)
  let hasBottleneck = false
  for (const room of rooms) {
    const grid = resolveGridConfig({
      venueWidthFt: room.venue_width,
      venueLengthFt: room.venue_length,
      boothWidthFt: room.booth_width,
      boothLengthFt: room.booth_length,
      spacingMode: room.spacing_mode ?? 'one_foot',
    })
    const result = analyzeStrollerClearance({
      rows: grid.rows,
      cols: grid.cols,
      boothWidthFt: room.booth_width,
      boothLengthFt: room.booth_length,
      cells: room.cells ?? [],
      venueElements: room.venue_elements ?? [],
    })
    if (result.hasBottleneck) hasBottleneck = true
  }
  return hasBottleneck ? 'caution' : 'friendly'
}

export function getLayoutRooms(layout: BoothLayout): LayoutRoom[] {
  if (layout.layout_rooms && layout.layout_rooms.length > 0) {
    return layout.layout_rooms
  }
  return [
    {
      id: 'main',
      name: 'Main Hall',
      venue_width: layout.venue_width,
      venue_length: layout.venue_length,
      booth_width: layout.booth_width,
      booth_length: layout.booth_length,
      entrance: layout.entrance,
      spacing_mode: layout.spacing_mode ?? 'one_foot',
      cells: layout.cells ?? [],
      venue_elements: layout.venue_elements ?? [],
    },
  ]
}

export const PET_POLICY_LABELS: Record<string, string> = {
  pet_friendly: 'Pet-friendly — leashed pets welcome',
  service_animals_only: 'Service animals only',
  no_pets: 'No pets allowed',
}
