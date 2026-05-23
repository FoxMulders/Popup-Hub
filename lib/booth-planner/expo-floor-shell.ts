/**
 * Expo-style market floor grammar (Edmonton Expo Centre pattern):
 * - 1-cell structural outer wall shell
 * - 4′ open concourse / vending margin (no fixtures)
 * - Wide carved entrance & exit openings on the perimeter
 * - Optional interior spine aisles for cross-hall traffic (Standard layout)
 */
import type { VenueElement } from '@/types/database'
import { PERIMETER_VENDING_MARGIN_CELLS } from '@/lib/booth-planner/perimeter-clearance'
import {
  buildUniversalPerimeterWallsSkipping,
} from '@/lib/booth-planner/layout-engine/universal-frame'
import { exitWallForEntrance, type WallSide } from '@/lib/booth-planner/venue-elements'

export interface ExpoFloorShellOptions {
  cols: number
  rows: number
  entrance: WallSide
  /** When true, paint N-S and E-W spine aisles through the interior core only. */
  includeInteriorSpineAisles?: boolean
}

function newId(): string {
  return crypto.randomUUID()
}

/** Wide opening span — expo halls use multi-cell entry/exit cutouts, not single doors. */
export function doorOpeningSpan(
  cols: number,
  rows: number,
  wall: WallSide
): { colSpan: number; rowSpan: number } {
  const horizontal = wall === 'south' || wall === 'north'
  const along = horizontal ? cols : rows
  const span = Math.min(8, Math.max(4, Math.floor(along * 0.12)))
  return horizontal ? { colSpan: span, rowSpan: 1 } : { colSpan: 1, rowSpan: span }
}

export function doorOpeningOrigin(
  wall: WallSide,
  cols: number,
  rows: number,
  colSpan: number,
  rowSpan: number
): { row: number; col: number } {
  const centerCol = Math.floor(cols / 2)
  const centerRow = Math.floor(rows / 2)
  if (wall === 'south') {
    return { row: 0, col: Math.max(0, centerCol - Math.floor(colSpan / 2)) }
  }
  if (wall === 'north') {
    return { row: rows - 1, col: Math.max(0, centerCol - Math.floor(colSpan / 2)) }
  }
  if (wall === 'west') {
    return { row: Math.max(0, centerRow - Math.floor(rowSpan / 2)), col: 0 }
  }
  return { row: Math.max(0, centerRow - Math.floor(rowSpan / 2)), col: cols - 1 }
}

function openingCellKeys(
  wall: WallSide,
  cols: number,
  rows: number,
  type: 'entrance' | 'exit'
): Set<string> {
  const span = doorOpeningSpan(cols, rows, wall)
  const { row, col } = doorOpeningOrigin(wall, cols, rows, span.colSpan, span.rowSpan)
  const keys = new Set<string>()
  for (let r = row; r < row + span.rowSpan; r++) {
    for (let c = col; c < col + span.colSpan; c++) {
      keys.add(`${r}-${c}`)
    }
  }
  return keys
}

function doorElement(
  wall: WallSide,
  cols: number,
  rows: number,
  type: 'entrance' | 'exit'
): VenueElement {
  const span = doorOpeningSpan(cols, rows, wall)
  const { row, col } = doorOpeningOrigin(wall, cols, rows, span.colSpan, span.rowSpan)
  return {
    id: newId(),
    type,
    row,
    col,
    colSpan: span.colSpan,
    rowSpan: span.rowSpan,
    locked: true,
    label: type === 'entrance' ? 'Main entrance' : 'Emergency exit',
  }
}

function paintInteriorSpineAisles(
  elements: VenueElement[],
  cols: number,
  rows: number,
  occupied: Set<string>
): void {
  const m = PERIMETER_VENDING_MARGIN_CELLS
  if (cols <= m * 2 + 6 || rows <= m * 2 + 6) return

  const midCol = Math.floor(cols / 2)
  const midRow = Math.floor(rows / 2)

  for (let r = m + 1; r < rows - m - 1; r++) {
    const key = `${r}-${midCol}`
    if (!occupied.has(key)) {
      elements.push({
        id: newId(),
        type: 'aisle',
        row: r,
        col: midCol,
        colSpan: 1,
        rowSpan: 1,
        locked: true,
      })
      occupied.add(key)
    }
  }

  for (let c = m + 1; c < cols - m - 1; c++) {
    const key = `${midRow}-${c}`
    if (!occupied.has(key)) {
      elements.push({
        id: newId(),
        type: 'aisle',
        row: midRow,
        col: c,
        colSpan: 1,
        rowSpan: 1,
        locked: true,
      })
      occupied.add(key)
    }
  }
}

/**
 * Build the universal expo-style floor shell used by blank canvas, hall presets, and Outside only.
 */
export function buildExpoStyleVenueShell({
  cols,
  rows,
  entrance,
  includeInteriorSpineAisles = false,
}: ExpoFloorShellOptions): VenueElement[] {
  if (cols < 1 || rows < 1) return []

  const exitWall = exitWallForEntrance(entrance)
  const skip = new Set<string>([
    ...openingCellKeys(entrance, cols, rows, 'entrance'),
    ...openingCellKeys(exitWall, cols, rows, 'exit'),
  ])

  const elements: VenueElement[] = buildUniversalPerimeterWallsSkipping(cols, rows, skip)
  const occupied = new Set<string>(skip)
  for (const wall of elements) {
    const spanC = wall.colSpan ?? 1
    const spanR = wall.rowSpan ?? 1
    for (let r = wall.row; r < wall.row + spanR; r++) {
      for (let c = wall.col; c < wall.col + spanC; c++) {
        occupied.add(`${r}-${c}`)
      }
    }
  }

  elements.push(doorElement(entrance, cols, rows, 'entrance'))
  elements.push(doorElement(exitWall, cols, rows, 'exit'))

  if (includeInteriorSpineAisles) {
    paintInteriorSpineAisles(elements, cols, rows, occupied)
  }

  return elements
}

/** Outside only: 1-cell perimeter wall + wide doors — no interior columns or spine aisles. */
export function buildOutsideOnlyVenueShell(
  cols: number,
  rows: number,
  entrance: WallSide
): VenueElement[] {
  return buildExpoStyleVenueShell({
    cols,
    rows,
    entrance,
    includeInteriorSpineAisles: false,
  })
}

/** Entrance + exit only (no wall shell) — for co-plan overlay on existing interiors. */
export function buildExpoStyleDoorwaysOnly(
  entrance: WallSide,
  cols: number,
  rows: number
): VenueElement[] {
  if (cols < 1 || rows < 1) return []
  const exitWall = exitWallForEntrance(entrance)
  return [
    doorElement(entrance, cols, rows, 'entrance'),
    doorElement(exitWall, cols, rows, 'exit'),
  ]
}
