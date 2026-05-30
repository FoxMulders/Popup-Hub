import type { PatronPathTrace } from '@/lib/booth-planner/patron-path-trace'
import { getEntranceWalkPoint, buildWalkabilityGrid } from '@/lib/booth-planner/patron-path-trace'
import {
  getRoomCanvasMetrics,
  resolveShopperRouteTrace,
  type ShopperRouteMode,
} from '@/lib/shopper/layout'
import type { BoothCell, LayoutRoom } from '@/types/database'

/** Fast availability check without running exposition TSP. */
export function isShopperRouteAvailable(
  room: LayoutRoom,
  mode: ShopperRouteMode,
  selectedBooth: BoothCell | null
): boolean {
  if (mode === 'vendor') return selectedBooth != null

  const metrics = getRoomCanvasMetrics(room)
  const walkable = buildWalkabilityGrid(
    metrics.canvasRows,
    metrics.cols,
    metrics.venueElements,
    metrics.placedCells
  )
  const entrance = getEntranceWalkPoint(
    metrics.venueElements,
    room.entrance,
    walkable,
    metrics.canvasRows,
    metrics.cols
  )
  if (!entrance) return false

  if (mode === 'exposition') {
    return true
  }

  return resolveShopperRouteTrace(room, mode, selectedBooth) != null
}

/** Yield to the browser before heavy pathfinding (exposition TSP). */
export function computeRouteTraceAsync(
  room: LayoutRoom,
  mode: ShopperRouteMode,
  selectedBooth: BoothCell | null
): Promise<PatronPathTrace | null> {
  return new Promise((resolve) => {
    const run = () => resolve(resolveShopperRouteTrace(room, mode, selectedBooth))

    if (mode !== 'exposition') {
      run()
      return
    }

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(run, { timeout: 250 })
      return
    }

    setTimeout(run, 0)
  })
}
