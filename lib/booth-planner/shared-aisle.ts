/**
 * Shared-aisle spatial math — opposing booth rows each project a 2′ front buffer
 * that merges into one 4′ painted Aisle (A) corridor (2′ + 2′).
 */
import { CO_GENERATED_AISLE_DEPTH_CELLS } from '@/lib/booth-planner/co-generated-aisles'
import { BOOTH_EQUIPMENT_DEPTH_FT } from '@/lib/booth-planner/table-space'
import type { StorefrontSide } from '@/lib/booth-planner/aisle-orientation'
import type { InteriorBounds } from '@/lib/booth-planner/indoor-corridor-layout'
import { CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS } from '@/lib/booth-planner/indoor-corridor-layout'

/** Half of a shared pedestrian aisle contributed by each opposing booth row (2′). */
export const SHARED_AISLE_HALF_BUFFER_CELLS = CO_GENERATED_AISLE_DEPTH_CELLS

/** Full merged width between back-to-back booth rows (2.5′ + 2.5′ = 5′ unified corridor). */
export const SHARED_AISLE_WIDTH_CELLS = 5

/** Vendor table equipment depth on the 1′ grid. */
export const BOOTH_ROW_DEPTH_CELLS = BOOTH_EQUIPMENT_DEPTH_FT

/** One back-to-back pair cycle: booth + shared aisle + booth. */
export const BACK_TO_BACK_PAIR_STRIDE_CELLS =
  BOOTH_ROW_DEPTH_CELLS + SHARED_AISLE_WIDTH_CELLS + BOOTH_ROW_DEPTH_CELLS

/** Passive discovery: half-angle of the forward sight cone (120° total). */
export const SIGHTLINE_CONE_HALF_ANGLE_DEG = 60

/** Minimum cosine alignment for passive discovery (cos 60° = 0.5). */
export const SIGHTLINE_CONE_MIN_ALIGNMENT = 0.5

export type SharedAisleOrientation = 'north-strip' | 'south-strip' | 'single-sided'

/** Row offset within a back-to-back pair cycle (0–11 on a 1′ grid). */
export function rowOffsetInPairCycle(row: number, bounds: InteriorBounds): number {
  const base = row - bounds.minRow
  if (base < 0) return -1
  return base % BACK_TO_BACK_PAIR_STRIDE_CELLS
}

/** True when the row sits inside a merged 4′ shared aisle band (interior blocks). */
export function isSharedAisleRow(row: number, bounds: InteriorBounds): boolean {
  const offset = rowOffsetInPairCycle(row, bounds)
  if (offset < 0) return false
  return offset >= BOOTH_ROW_DEPTH_CELLS && offset < BOOTH_ROW_DEPTH_CELLS + SHARED_AISLE_WIDTH_CELLS
}

/** True when row is a vendor strip in a back-to-back pair (not the shared aisle band). */
export function isBackToBackVendorRow(row: number, bounds: InteriorBounds): boolean {
  const offset = rowOffsetInPairCycle(row, bounds)
  if (offset < 0) return false
  if (offset < BOOTH_ROW_DEPTH_CELLS) return true
  if (offset >= BOOTH_ROW_DEPTH_CELLS + SHARED_AISLE_WIDTH_CELLS) return true
  return false
}

/** Which strip of a back-to-back pair this vendor row belongs to. */
export function sharedAisleStripAt(row: number, bounds: InteriorBounds): SharedAisleOrientation | null {
  const offset = rowOffsetInPairCycle(row, bounds)
  if (offset < 0 || isSharedAisleRow(row, bounds)) return null
  if (offset < BOOTH_ROW_DEPTH_CELLS) return 'north-strip'
  return 'south-strip'
}

/** Storefront must face the merged shared aisle between opposing rows. */
export function preferredStorefrontForSharedStrip(
  strip: SharedAisleOrientation
): StorefrontSide {
  return strip === 'north-strip' ? 'bottom' : 'top'
}

/** Interior column range between vertical row aisles (excludes perimeter bands). */
export function interiorBlockColumnRange(bounds: InteriorBounds): { minCol: number; maxCol: number } {
  return {
    minCol: bounds.minCol + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS,
    maxCol: bounds.maxCol - CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS,
  }
}

export function isInteriorBlockColumn(col: number, bounds: InteriorBounds): boolean {
  const { minCol, maxCol } = interiorBlockColumnRange(bounds)
  return col >= minCol && col <= maxCol
}

/** Enumerate shared aisle row indices to paint in interior blocks. */
export function sharedAisleRowsToPaint(bounds: InteriorBounds): number[] {
  const rows: number[] = []
  let r = bounds.minRow
  while (r + BACK_TO_BACK_PAIR_STRIDE_CELLS <= bounds.maxRow + 1) {
    const aisleStart = r + BOOTH_ROW_DEPTH_CELLS
    for (let sr = aisleStart; sr < aisleStart + SHARED_AISLE_WIDTH_CELLS; sr++) {
      if (sr >= bounds.minRow && sr <= bounds.maxRow) rows.push(sr)
    }
    r += BACK_TO_BACK_PAIR_STRIDE_CELLS
  }
  return rows
}

/** True when a booth at (row,col) should face a shared merged aisle (interior block). */
export function boothFacesSharedAisleModel(
  row: number,
  col: number,
  bounds: InteriorBounds
): boolean {
  if (!isInteriorBlockColumn(col, bounds)) return false
  return isBackToBackVendorRow(row, bounds)
}

/** Score orientation preference for shared-aisle strips (higher = better). */
export function sharedAisleOrientationBonus(
  row: number,
  col: number,
  storefront: StorefrontSide,
  bounds: InteriorBounds
): number {
  if (!boothFacesSharedAisleModel(row, col, bounds)) return 0
  const strip = sharedAisleStripAt(row, bounds)
  if (!strip) return 0
  return storefront === preferredStorefrontForSharedStrip(strip) ? 5000 : -5000
}
