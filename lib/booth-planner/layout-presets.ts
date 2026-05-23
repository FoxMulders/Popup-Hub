import { boothOverlapsPerimeterVendingLane } from '@/lib/booth-planner/perimeter-clearance'
import { perimeterVendingLaneOrigins } from '@/lib/booth-planner/outside-only-layout'
import {
  buildClusterPlacementOrder,
  clusterOriginsForBooth,
  isClusterPlacement,
  type OutdoorMarketVariant,
} from '@/lib/booth-planner/outdoor-market-shell'
import {
  indoorCorridorOriginsForBooth,
  isIndoorCorridorPlacement,
} from '@/lib/booth-planner/indoor-corridor-layout'

import {
  genericRowOriginsForBooth,
  genericRowLayoutModeFromPreset,
  isGenericRowLayoutPreset,
  isGenericRowPlacement,
  type GenericRowLayoutMode,
} from '@/lib/booth-planner/generic-row-layouts'

import {
  alignedGridOriginsForBooth,
  applyAlignedGridLayout,
  isAlignedGridPlacement,
} from '@/lib/booth-planner/aligned-grid-layout'
import {
  applyLShapeCornersLayout,
  isLShapeCornersPlacement,
  lShapeCornersOriginsForBooth,
} from '@/lib/booth-planner/l-shape-corners-layout'

export type LayoutPreset =
  | 'default'
  | 'perimeter'
  | 'outdoor'
  | 'vertical_rows'
  | 'horizontal_rows'
  | 'aligned_grid'
  | 'l_shape_corners'
  | 'snake'

/** Five AI-facing auto-plan presets shown in Step 3 layout picker. */
export const LAYOUT_AI_PRESET_OPTIONS: {
  id: LayoutPreset
  label: string
  description: string
}[] = [
  {
    id: 'vertical_rows',
    label: 'Vertical Rows',
    description:
      'N–S vendor columns with 5′ shared vertical aisles between back-to-back rows.',
  },
  {
    id: 'horizontal_rows',
    label: 'Horizontal Rows',
    description:
      'E–W vendor rows with 5′ shared horizontal aisles between back-to-back rows.',
  },
  {
    id: 'aligned_grid',
    label: 'Aligned Grid',
    description:
      'Uniform grid-aligned E–W rows — straight aisles and consistent booth spacing.',
  },
  {
    id: 'l_shape_corners',
    label: 'L-Shape Corners',
    description:
      'Perimeter ring focused on hall corners — keeps the center open for flow.',
  },
  {
    id: 'snake',
    label: 'Snake',
    description:
      'Serpentine S-curve shopper path with tables parallel to local flow.',
  },
]

export const LAYOUT_PRESET_OPTIONS: {
  id: LayoutPreset
  label: string
  description: string
}[] = [
  {
    id: 'default',
    label: 'Standard',
    description: 'Cluster vendors by category and fill from the entrance inward.',
  },
  {
    id: 'perimeter',
    label: 'Outside only',
    description: 'Indoor hall perimeter ring — 4′ concourse around walls; center open.',
  },
  {
    id: 'outdoor',
    label: 'Corridor rows',
    description:
      'Serpentine shared-aisle corridors — preserves indoor walls; open-lot grammar outdoors.',
  },
  ...LAYOUT_AI_PRESET_OPTIONS,
]

/** True when the booth footprint sits in the 4′ indoor outside-only vending margin. */
export function isPerimeterPlacement(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  if (rows <= 0 || cols <= 0) return false
  return boothOverlapsPerimeterVendingLane(row, col, rowSpan, colSpan, rows, cols)
}

/** Clockwise walk through the 4′ indoor vending margin starting at the entrance wall. */
export function buildPerimeterPlacementOrder(
  rows: number,
  cols: number,
  entrance: 'north' | 'south' | 'east' | 'west'
): [number, number][] {
  return perimeterVendingLaneOrigins(cols, rows, entrance)
}

/** Origins along the indoor perimeter that fit a booth of the given span. */
export function perimeterOriginsForBooth(
  rows: number,
  cols: number,
  entrance: 'north' | 'south' | 'east' | 'west',
  rowSpan: number,
  colSpan: number
): [number, number][] {
  const candidates: [number, number][] = []
  for (let r = 0; r <= rows - rowSpan; r++) {
    for (let c = 0; c <= cols - colSpan; c++) {
      if (isPerimeterPlacement(r, c, rowSpan, colSpan, rows, cols)) {
        candidates.push([r, c])
      }
    }
  }

  const ringOrder = buildPerimeterPlacementOrder(rows, cols, entrance)
  const rank = new Map<string, number>()
  ringOrder.forEach(([r, c], i) => rank.set(`${r}-${c}`, i))

  return candidates.sort((a, b) => {
    const ra = rank.get(`${a[0]}-${a[1]}`) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(`${b[0]}-${b[1]}`) ?? Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}

/** Re-export for auto-plan — outdoor cluster walk order. */
export { buildClusterPlacementOrder, isClusterPlacement, clusterOriginsForBooth }
export { indoorCorridorOriginsForBooth, isIndoorCorridorPlacement }
export {
  genericRowLayoutModeFromPreset,
  isGenericRowLayoutPreset,
  applyGenericRowLayout,
  isGenericRowPlacement,
} from '@/lib/booth-planner/generic-row-layouts'
export type { GenericRowLayoutMode } from '@/lib/booth-planner/generic-row-layouts'
export type { OutdoorMarketVariant }

/** True when preset uses pre-painted shared-aisle row/column grammar. */
export function isStructuredRowPreset(preset: LayoutPreset): boolean {
  return (
    preset === 'outdoor' ||
    preset === 'aligned_grid' ||
    preset === 'l_shape_corners' ||
    isGenericRowLayoutPreset(preset)
  )
}

/** Origins for constrained presets (perimeter ring, outdoor clusters, corridor, or generic rows). */
export function constrainedOriginsForBooth(
  preset: LayoutPreset,
  rows: number,
  cols: number,
  entrance: 'north' | 'south' | 'east' | 'west',
  rowSpan: number,
  colSpan: number,
  outdoorVariant: OutdoorMarketVariant = 'street-fair',
  useIndoorCorridor = false
): [number, number][] {
  const genericMode = genericRowLayoutModeFromPreset(preset)
  if (genericMode) {
    return genericRowOriginsForBooth(genericMode, rows, cols, entrance, rowSpan, colSpan)
  }
  if (useIndoorCorridor) {
    return indoorCorridorOriginsForBooth(rows, cols, entrance, rowSpan, colSpan)
  }
  if (preset === 'outdoor') {
    return clusterOriginsForBooth(rows, cols, entrance, rowSpan, colSpan, outdoorVariant)
  }
  if (preset === 'perimeter') {
    return perimeterOriginsForBooth(rows, cols, entrance, rowSpan, colSpan)
  }
  if (preset === 'aligned_grid') {
    return alignedGridOriginsForBooth(rows, cols, entrance, rowSpan, colSpan)
  }
  if (preset === 'l_shape_corners') {
    return lShapeCornersOriginsForBooth(rows, cols, entrance, rowSpan, colSpan)
  }
  return []
}
