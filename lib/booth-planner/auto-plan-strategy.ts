import type { BoothCell, VenueElement } from '@/types/database'
import {
  type GenericRowLayoutMode,
  type LayoutPreset,
  genericRowLayoutModeFromPreset,
} from '@/lib/booth-planner/layout-presets'
import { hallHasIndoorShell } from '@/lib/booth-planner/indoor-shell'
import { applyOutsideOnlyLayout } from '@/lib/booth-planner/outside-only-layout'
import { applyAlignedGridLayout } from '@/lib/booth-planner/aligned-grid-layout'
import { applyLShapeCornersLayout } from '@/lib/booth-planner/l-shape-corners-layout'
import { applyIndoorCorridorLayout } from '@/lib/booth-planner/indoor-corridor-layout'
import { applyOutdoorMarketLayout } from '@/lib/booth-planner/outdoor-market-shell'
import { applyGenericRowLayout } from '@/lib/booth-planner/generic-row-layouts'

export interface AutoPlanLayoutPatch {
  venue_elements: VenueElement[]
  cells: BoothCell[]
}

export interface AutoPlanStrategyInput {
  layoutPreset: LayoutPreset
  gridCols: number
  gridRows: number
  entrance: 'north' | 'south' | 'east' | 'west'
  venueElementsWithDoors: VenueElement[]
  isOneFootGrid: boolean
}

export interface AutoPlanStrategy {
  /** Preset passed to autoLayout (default → outdoor when corridor grammar applies). */
  effectivePreset: LayoutPreset
  useCorridor: boolean
  coGenerateAisles: boolean
  genericMode: GenericRowLayoutMode | null
  presetShell: AutoPlanLayoutPatch | null
  venueElementsForPlan: VenueElement[]
}

/**
 * Resolve auto-plan preset, corridor shell painting, and co-generated aisle mode.
 * Indoor hall templates (Kilkenny 40×72, etc.) use painted corridor rows instead of
 * coGenerateAisles on an open floor — avoids dense false stroller bottlenecks.
 */
export function resolveAutoPlanStrategy(input: AutoPlanStrategyInput): AutoPlanStrategy {
  const { layoutPreset, gridCols, gridRows, entrance, venueElementsWithDoors, isOneFootGrid } =
    input

  const genericMode = genericRowLayoutModeFromPreset(layoutPreset)
  const snakePreset = layoutPreset === 'snake'
  const indoorShell = hallHasIndoorShell(venueElementsWithDoors, gridCols, gridRows)
  const useCorridor =
    snakePreset || (indoorShell && (layoutPreset === 'outdoor' || layoutPreset === 'default'))

  const effectivePreset: LayoutPreset =
    useCorridor && layoutPreset === 'default' ? 'outdoor' : layoutPreset

  const presetShell: AutoPlanLayoutPatch | null =
    effectivePreset === 'perimeter'
      ? applyOutsideOnlyLayout(gridCols, gridRows, entrance)
      : effectivePreset === 'aligned_grid'
        ? applyAlignedGridLayout(gridCols, gridRows, entrance, venueElementsWithDoors)
        : effectivePreset === 'l_shape_corners'
          ? applyLShapeCornersLayout(gridCols, gridRows, entrance)
          : effectivePreset === 'outdoor'
            ? useCorridor
              ? applyIndoorCorridorLayout(gridCols, gridRows, entrance, venueElementsWithDoors)
              : applyOutdoorMarketLayout(gridCols, gridRows, entrance)
            : genericMode
              ? applyGenericRowLayout(
                  genericMode,
                  gridCols,
                  gridRows,
                  entrance,
                  venueElementsWithDoors
                )
              : null

  const coGenerateAisles = isOneFootGrid && layoutPreset === 'default' && !indoorShell
  const venueElementsForPlan = presetShell?.venue_elements ?? venueElementsWithDoors

  return {
    effectivePreset,
    useCorridor,
    coGenerateAisles,
    genericMode,
    presetShell,
    venueElementsForPlan,
  }
}
