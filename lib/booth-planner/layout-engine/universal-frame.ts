import type { VenueElement } from '@/types/database'
import { buildMergedPerimeterWallElements } from '@/lib/booth-planner/perimeter-wall-segments'
import type { VenueFixedAsset } from '@/lib/booth-planner/venue-presets'
import { presetAssetToGridRect } from '@/lib/booth-planner/venue-presets'

function newId(): string {
  return crypto.randomUUID()
}

export interface DoorOpening {
  row: number
  col: number
  colSpan?: number
  rowSpan?: number
}

function openingCellKeys(openings: DoorOpening[]): Set<string> {
  const skip = new Set<string>()
  for (const op of openings) {
    const spanC = op.colSpan ?? 1
    const spanR = op.rowSpan ?? 1
    for (let r = op.row; r < op.row + spanR; r++) {
      for (let c = op.col; c < op.col + spanC; c++) {
        skip.add(`${r}-${c}`)
      }
    }
  }
  return skip
}

/** 1-cell-thick outer wall boundary along dynamic grid limits, with optional door cutouts. */
export function buildUniversalPerimeterWalls(
  cols: number,
  rows: number,
  openings: DoorOpening[] = [],
  label = 'Perimeter wall'
): VenueElement[] {
  return buildMergedPerimeterWallElements(cols, rows, openingCellKeys(openings), label)
}

/** Same as buildUniversalPerimeterWalls but accepts a flat set of opening cell keys. */
export function buildUniversalPerimeterWallsSkipping(
  cols: number,
  rows: number,
  skipCells: Set<string>,
  label = 'Perimeter wall'
): VenueElement[] {
  return buildMergedPerimeterWallElements(cols, rows, skipCells, label)
}

function lockElementFromAsset(asset: VenueFixedAsset, canvasHeight: number): VenueElement {
  const { col, row, colSpan, rowSpan } = presetAssetToGridRect(asset, canvasHeight)
  const label = asset.label?.trim() || 'Locked zone'
  const isStage =
    /raised stage|performance platform|permanent stage|main stage/i.test(label) &&
    !/stairs|stair/i.test(label)
  const isBar = /bar|kitchen|hatch|concession/i.test(label)
  return {
    id: newId(),
    type: isStage ? 'stage' : isBar ? 'food_court' : 'custom_label',
    row,
    col,
    colSpan,
    rowSpan,
    label,
    locked: true,
  }
}

function interiorWallFromAsset(asset: VenueFixedAsset, canvasHeight: number): VenueElement {
  const { col, row, colSpan, rowSpan } = presetAssetToGridRect(asset, canvasHeight)
  return {
    id: newId(),
    type: 'column',
    row,
    col,
    colSpan,
    rowSpan,
    label: asset.label?.trim(),
    locked: true,
  }
}

/** Parse venue fixedAssets into locked structural obstacles (Bar, Stage, walls, etc.). */
export function buildLockedStructuralElements(
  fixedAssets: VenueFixedAsset[],
  canvasHeight: number
): VenueElement[] {
  return fixedAssets.map((asset) =>
    asset.type === 'Wall'
      ? interiorWallFromAsset(asset, canvasHeight)
      : lockElementFromAsset(asset, canvasHeight)
  )
}
