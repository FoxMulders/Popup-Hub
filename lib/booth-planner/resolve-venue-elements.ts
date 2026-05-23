import type { VenueElement } from '@/types/database'
import {
  ensureEntranceAndExit,
  coalescePerimeterWallElements,
} from '@/lib/booth-planner/venue-elements'

/**
 * Empty canvas rule: do not inject entrance/exit/aisles until the coordinator
 * paints fixtures or runs Apply / Auto-Plan.
 */
export function resolveVenueElementsForCanvas(
  venueElements: VenueElement[],
  entrance: 'north' | 'south' | 'east' | 'west',
  gridCols: number,
  gridRows: number
): VenueElement[] {
  if (venueElements.length === 0) return []
  const withDoors = ensureEntranceAndExit(venueElements, entrance, gridCols, gridRows)
  return coalescePerimeterWallElements(withDoors, gridCols, gridRows)
}
