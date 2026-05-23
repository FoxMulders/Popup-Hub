import type { LayoutSpacingMode } from '@/types/database'
import type { StorefrontSide } from '@/lib/booth-planner/aisle-orientation'
import type { FrontSide } from '@/lib/booth-planner/co-generated-aisles'
import { boothFrontSide } from '@/lib/booth-planner/co-generated-aisles'
import {
  gridSpansForTableOrientation,
  type TableOrientation,
} from '@/lib/booth-planner/table-orientation'

/** Cardinal wall or diagonal corner quadrant a booth storefront faces. */
export type FacingTarget =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se'

export const FACING_TARGET_OPTIONS: { id: FacingTarget; label: string; short: string }[] = [
  { id: 'nw', label: 'Northwest Corner', short: 'NW' },
  { id: 'north', label: 'North Wall', short: 'N' },
  { id: 'ne', label: 'Northeast Corner', short: 'NE' },
  { id: 'west', label: 'West Wall', short: 'W' },
  { id: 'south', label: 'South Wall', short: 'S' },
  { id: 'east', label: 'East Wall', short: 'E' },
  { id: 'sw', label: 'Southwest Corner', short: 'SW' },
  { id: 'se', label: 'Southeast Corner', short: 'SE' },
]

export function facingTargetLabel(target: FacingTarget): string {
  return FACING_TARGET_OPTIONS.find((o) => o.id === target)?.label ?? target
}

/** Default facing when no override — booth front toward entrance wall. */
export function facingTargetFromEntrance(
  entrance: 'north' | 'south' | 'east' | 'west'
): FacingTarget {
  return entrance
}

/** Rotate a facing target 180° (cardinal and diagonal pairs). */
export function invertFacingTarget(target: FacingTarget): FacingTarget {
  switch (target) {
    case 'north':
      return 'south'
    case 'south':
      return 'north'
    case 'east':
      return 'west'
    case 'west':
      return 'east'
    case 'nw':
      return 'se'
    case 'ne':
      return 'sw'
    case 'sw':
      return 'ne'
    case 'se':
      return 'nw'
  }
}

/** Cardinal wall a booth storefront side faces (inverse of north/south/east/west → top/bottom/left/right). */
export function facingTargetForStorefrontSide(side: StorefrontSide): FacingTarget {
  switch (side) {
    case 'top':
      return 'north'
    case 'bottom':
      return 'south'
    case 'left':
      return 'west'
    case 'right':
      return 'east'
  }
}

export function storefrontSideForFacingTarget(
  target: FacingTarget,
  row: number,
  col: number,
  rows: number,
  cols: number
): StorefrontSide {
  switch (target) {
    case 'north':
      return 'top'
    case 'south':
      return 'bottom'
    case 'east':
      return 'right'
    case 'west':
      return 'left'
    case 'nw': {
      const dNorth = row
      const dWest = col
      return dNorth <= dWest ? 'top' : 'left'
    }
    case 'ne': {
      const dNorth = row
      const dEast = cols - 1 - col
      return dNorth <= dEast ? 'top' : 'right'
    }
    case 'sw': {
      const dSouth = rows - 1 - row
      const dWest = col
      return dSouth <= dWest ? 'bottom' : 'left'
    }
    case 'se': {
      const dSouth = rows - 1 - row
      const dEast = cols - 1 - col
      return dSouth <= dEast ? 'bottom' : 'right'
    }
  }
}

export function tableOrientationForStorefront(storefront: StorefrontSide): TableOrientation {
  return storefront === 'left' || storefront === 'right' ? 'vertical' : 'horizontal'
}

/** Snap storefront toward nearest wall or corner from a grid origin. */
export function inferFacingTargetAtPosition(
  row: number,
  col: number,
  rows: number,
  cols: number
): FacingTarget {
  const dNorth = row
  const dSouth = rows - 1 - row
  const dWest = col
  const dEast = cols - 1 - col
  const minDist = Math.min(dNorth, dSouth, dWest, dEast)
  const cornerBand = minDist + 2

  if (dNorth <= cornerBand && dWest <= cornerBand) return 'nw'
  if (dNorth <= cornerBand && dEast <= cornerBand) return 'ne'
  if (dSouth <= cornerBand && dWest <= cornerBand) return 'sw'
  if (dSouth <= cornerBand && dEast <= cornerBand) return 'se'

  if (minDist === dNorth) return 'north'
  if (minDist === dSouth) return 'south'
  if (minDist === dWest) return 'west'
  return 'east'
}

export interface ManualFacingPlacement {
  colSpan: number
  rowSpan: number
  tableOrientation: TableOrientation
  storefront: StorefrontSide
  facingTarget: FacingTarget
}

/** Resolve booth spans + table axis for a manual facing override at (row,col). */
export function resolveManualFacingPlacement(
  facingTarget: FacingTarget,
  row: number,
  col: number,
  tableLengthFt: number,
  spacingMode: LayoutSpacingMode,
  rows: number,
  cols: number
): ManualFacingPlacement {
  const storefront = storefrontSideForFacingTarget(facingTarget, row, col, rows, cols)
  const tableOrientation = tableOrientationForStorefront(storefront)
  const { colSpan, rowSpan } = gridSpansForTableOrientation(
    tableLengthFt,
    spacingMode,
    tableOrientation
  )
  return { colSpan, rowSpan, tableOrientation, storefront, facingTarget }
}

/** Effective storefront side for rendering — uses override or entrance default. */
export function effectiveStorefrontSide(
  facingTarget: FacingTarget | null | undefined,
  entrance: 'north' | 'south' | 'east' | 'west',
  row: number,
  col: number,
  rows: number,
  cols: number
): FrontSide {
  const target = facingTarget ?? facingTargetFromEntrance(entrance)
  return storefrontSideForFacingTarget(target, row, col, rows, cols)
}

/** Map entrance-only callers to storefront (legacy co-aisle helpers). */
export function storefrontFromEntrance(
  entrance: 'north' | 'south' | 'east' | 'west'
): FrontSide {
  return boothFrontSide(entrance)
}
