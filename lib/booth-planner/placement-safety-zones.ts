import type { VenueElement } from '@/types/database'
import { collectStairEgressZoneKeys } from '@/lib/booth-planner/stair-egress-zones'
import { collectExitKeepoutZoneKeys } from '@/lib/booth-planner/exit-keepout-zones'

/** Merge stair landings + exit keep-out cones into blocked keys for placement. */
export function mergeSafetyBlockedKeys(
  blocked: Set<string>,
  elements: VenueElement[],
  cols: number,
  rows: number,
  hallRows: number = rows
): Set<string> {
  const merged = new Set(blocked)
  for (const k of collectStairEgressZoneKeys(elements, hallRows, cols, rows)) {
    merged.add(k)
  }
  for (const k of collectExitKeepoutZoneKeys(elements, cols, rows)) {
    merged.add(k)
  }
  return merged
}
