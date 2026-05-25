import type { VenueElement, VenueElementType } from '@/types/database'
import {
  buildExpoStyleDoorwaysOnly,
  buildExpoStyleVenueShell,
} from '@/lib/booth-planner/expo-floor-shell'
import { cellsOfElement, isOuterPerimeterCell } from '@/lib/booth-planner/perimeter-clearance'
import {
  buildMergedPerimeterWallElements,
  isPerimeterWallElement,
} from '@/lib/booth-planner/perimeter-wall-segments'

export const VENUE_ELEMENT_TOOLS: {
  type: VenueElementType | 'eraser'
  label: string
  shortLabel: string
  description: string
}[] = [
  {
    type: 'eraser',
    label: 'Eraser',
    shortLabel: 'Erase',
    description: 'Remove fixtures or unplace vendors (click a booth to send it back to Unplaced)',
  },
  {
    type: 'entrance',
    label: 'Main Entrance',
    shortLabel: 'Entrance',
    description: 'Drag the entrance on its wall, or click an outer-wall cell on the entrance side',
  },
  { type: 'door', label: 'Door', shortLabel: 'Door', description: 'Additional door or entry' },
  {
    type: 'exit',
    label: 'Emergency Exit',
    shortLabel: 'Exit',
    description: 'Drag the exit on its wall, or click an outer-wall cell on the opposite wall',
  },
  {
    type: 'aisle',
    label: 'Aisle',
    shortLabel: 'Aisle',
    description: 'Walkway (min 8ft clear width for stroller traffic) — booths cannot be placed here',
  },
  { type: 'restroom', label: 'Restroom', shortLabel: 'Restroom', description: 'Restroom facilities' },
  { type: 'food_court', label: 'Food / Concessions', shortLabel: 'Food', description: 'Food court or concessions' },
  {
    type: 'seating',
    label: 'Seating / Tables',
    shortLabel: 'Tables',
    description: 'Tables and chairs for guests to sit and eat',
  },
  { type: 'stage', label: 'Stage / Performance', shortLabel: 'Stage', description: 'Stage or demo area' },
  { type: 'loading_dock', label: 'Loading Dock', shortLabel: 'Loading', description: 'Vendor load-in area' },
  { type: 'storage', label: 'Storage', shortLabel: 'Storage', description: 'Storage or back-of-house' },
  { type: 'info_desk', label: 'Info Desk', shortLabel: 'Info', description: 'Information or check-in desk' },
  {
    type: 'welcome_booth',
    label: 'Welcome Booth',
    shortLabel: 'Welcome',
    description: 'Guest welcome / information booth (not a vendor space)',
  },
  { type: 'column', label: 'Column / Obstacle', shortLabel: 'Column', description: 'Structural column or pillar' },
  { type: 'custom_label', label: 'Custom Label', shortLabel: 'Label', description: 'Named area (you choose the text)' },
]

export const ELEMENT_STYLES: Record<
  VenueElementType,
  { className: string; icon?: string }
> = {
  entrance: { className: 'bg-sage-100 border-2 border-forest text-sage-900' },
  door: { className: 'bg-harvest-100 border-2 border-harvest-500 text-harvest-900' },
  exit: { className: 'bg-terracotta-50 border-2 border-terracotta-500 text-terracotta-800' },
  aisle: { className: 'bg-canvas border border-dashed border-harvest-300 text-muted-foreground' },
  restroom: { className: 'bg-stone-100 border-2 border-stone-400 text-stone-800' },
  food_court: { className: 'bg-harvest-50 border-2 border-harvest-400 text-harvest-800' },
  seating: { className: 'bg-linen border-2 border-stone-300 text-foreground' },
  stage: { className: 'bg-stone-100 border-2 border-stone-500 text-espresso' },
  loading_dock: { className: 'bg-stone-200 border-2 border-stone-500 text-stone-800' },
  storage: { className: 'bg-canvas border-2 border-stone-300 text-muted-foreground' },
  info_desk: { className: 'bg-sage-50 border-2 border-sage-400 text-sage-900' },
  welcome_booth: { className: 'bg-sage-100 border-2 border-sage-600 text-sage-900' },
  column: { className: 'bg-stone-300 border-2 border-stone-500 text-stone-800' },
  custom_label: { className: 'bg-card border-2 border-stone-300 text-foreground' },
}

export function cellKey(row: number, col: number): string {
  return `${row}-${col}`
}

/** Map each grid cell to its top-most venue element (origin cell only in iteration). */
export function buildVenueElementMap(elements: VenueElement[]): Map<string, VenueElement> {
  const map = new Map<string, VenueElement>()
  for (const el of elements) {
    const spanC = el.colSpan ?? 1
    const spanR = el.rowSpan ?? 1
    for (let r = el.row; r < el.row + spanR; r++) {
      for (let c = el.col; c < el.col + spanC; c++) {
        map.set(cellKey(r, c), el)
      }
    }
  }
  return map
}

/** All cells blocked by venue fixtures (no booth placement). Stage alcoves stay vendor-placeable for markets. */
export function blockedCellKeys(elements: VenueElement[]): Set<string> {
  const keys = new Set<string>()
  for (const el of elements) {
    if (el.type === 'stage') continue
    const spanC = el.colSpan ?? 1
    const spanR = el.rowSpan ?? 1
    for (let r = el.row; r < el.row + spanR; r++) {
      for (let c = el.col; c < el.col + spanC; c++) {
        keys.add(cellKey(r, c))
      }
    }
  }
  return keys
}

export function getElementAt(
  elements: VenueElement[],
  row: number,
  col: number
): VenueElement | undefined {
  return buildVenueElementMap(elements).get(cellKey(row, col))
}

export function isElementOrigin(el: VenueElement, row: number, col: number): boolean {
  return el.row === row && el.col === col
}

export function displayLabel(el: VenueElement): string {
  if (el.label?.trim()) return el.label.trim()
  const tool = VENUE_ELEMENT_TOOLS.find((t) => t.type === el.type)
  return tool?.shortLabel ?? el.type
}

/** Labels rendered on the floor canvas — structural/perimeter zones stay blank (tooltip only). */
export function fixtureCanvasLabel(
  el: VenueElement,
  cols: number,
  rows: number
): string {
  if (el.type === 'aisle') return ''
  if (isPerimeterWallElement(el, cols, rows)) return ''
  if (el.type === 'column' && !el.label?.trim()) return ''
  if (el.type === 'column' && el.locked) return ''
  return displayLabel(el)
}

/** Merge fragmented 1×1 perimeter column cells into continuous wall runs. */
export function coalescePerimeterWallElements(
  elements: VenueElement[],
  cols: number,
  rows: number
): VenueElement[] {
  const nonPerimeterWall: VenueElement[] = []
  const perimeterWallCells = new Set<string>()

  for (const el of elements) {
    if (el.type === 'column' && isPerimeterWallElement(el, cols, rows)) {
      for (const { row, col } of cellsOfElement(el)) {
        perimeterWallCells.add(cellKey(row, col))
      }
    } else {
      nonPerimeterWall.push(el)
    }
  }

  if (perimeterWallCells.size === 0) return elements

  const skipCells = new Set<string>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isOuterPerimeterCell(r, c, cols, rows)) continue
      if (!perimeterWallCells.has(cellKey(r, c))) {
        skipCells.add(cellKey(r, c))
      }
    }
  }

  for (const el of nonPerimeterWall) {
    if (el.type === 'entrance' || el.type === 'exit' || el.type === 'door') {
      for (const { row, col } of cellsOfElement(el)) {
        skipCells.add(cellKey(row, col))
      }
    }
  }

  return [...nonPerimeterWall, ...buildMergedPerimeterWallElements(cols, rows, skipCells)]
}

export type WallSide = 'north' | 'south' | 'east' | 'west'

export function oppositeWall(wall: WallSide): WallSide {
  if (wall === 'north') return 'south'
  if (wall === 'south') return 'north'
  if (wall === 'west') return 'east'
  return 'west'
}

/** Which outer wall a grid cell lies on, if any. */
export function wallAtCell(
  row: number,
  col: number,
  cols: number,
  rows: number
): WallSide | null {
  if (cols < 1 || rows < 1) return null
  if (row === 0) return 'south'
  if (row === rows - 1) return 'north'
  if (col === 0) return 'west'
  if (col === cols - 1) return 'east'
  return null
}

export function exitWallForEntrance(entranceWall: WallSide): WallSide {
  return oppositeWall(entranceWall)
}

/** Expo-style shell: wall perimeter, wide doors, 4′ concourse margin, interior spine aisles. */
export function buildDefaultVenueElements(
  entrance: WallSide,
  cols: number,
  rows: number
): VenueElement[] {
  return buildExpoStyleVenueShell({
    cols,
    rows,
    entrance,
    includeInteriorSpineAisles: true,
  })
}

/** Move entrance or exit along its outer wall; vacated opening cells become perimeter wall. */
export function moveDoorOnWall(
  elements: VenueElement[],
  doorType: 'entrance' | 'exit',
  entranceWall: WallSide,
  targetRow: number,
  targetCol: number,
  cols: number,
  rows: number
): VenueElement[] {
  if (cols < 1 || rows < 1) return elements

  const requiredWall = doorType === 'entrance' ? entranceWall : exitWallForEntrance(entranceWall)
  if (wallAtCell(targetRow, targetCol, cols, rows) !== requiredWall) return elements

  const door = elements.find((e) => e.type === doorType)
  if (!door || isFixtureLocked(door)) return elements

  const spanC = door.colSpan ?? 1
  const spanR = door.rowSpan ?? 1
  if (door.row === targetRow && door.col === targetCol) return elements

  const targetEl = getElementAt(elements, targetRow, targetCol)
  if (targetEl && isFixtureLocked(targetEl)) return elements

  let next = elements.filter((e) => e.id !== door.id)

  const stampWall = (row: number, col: number) => {
    if (wallAtCell(row, col, cols, rows) !== requiredWall) return
    next = next.filter((e) => !(e.row === row && e.col === col && (e.colSpan ?? 1) === 1))
    next.push({
      id: crypto.randomUUID(),
      type: 'column',
      row,
      col,
      colSpan: 1,
      rowSpan: 1,
      locked: true,
      label: 'Perimeter wall',
    })
  }

  for (let r = door.row; r < door.row + spanR; r++) {
    for (let c = door.col; c < door.col + spanC; c++) {
      stampWall(r, c)
    }
  }

  for (let r = targetRow; r < targetRow + spanR; r++) {
    for (let c = targetCol; c < targetCol + spanC; c++) {
      next = next.filter((e) => !(e.row === r && e.col === c && (e.colSpan ?? 1) === 1))
    }
  }

  if (targetEl && targetEl.id !== door.id) {
    next = next.filter((e) => e.id !== targetEl.id)
  }

  next.push({
    ...door,
    row: targetRow,
    col: targetCol,
    colSpan: spanC,
    rowSpan: spanR,
  })

  return next
}

/** Reposition wide entrance/exit cutouts when the entrance wall setting changes. */
export function relocateDoorsForEntranceWall(
  elements: VenueElement[],
  entranceWall: WallSide,
  cols: number,
  rows: number
): VenueElement[] {
  if (cols < 1 || rows < 1) return elements

  const entrance = elements.find((e) => e.type === 'entrance')
  const exit = elements.find((e) => e.type === 'exit')
  const defaults = buildExpoStyleDoorwaysOnly(entranceWall, cols, rows)
  const defaultEntrance = defaults.find((e) => e.type === 'entrance')
  const defaultExit = defaults.find((e) => e.type === 'exit')
  if (!defaultEntrance || !defaultExit) return elements

  let withoutDoors = elements.filter((e) => e.type !== 'entrance' && e.type !== 'exit')

  const clearFootprint = (el: VenueElement) => {
    for (let r = el.row; r < el.row + (el.rowSpan ?? 1); r++) {
      for (let c = el.col; c < el.col + (el.colSpan ?? 1); c++) {
        withoutDoors = withoutDoors.filter(
          (e) => !(e.row === r && e.col === c && (e.colSpan ?? 1) === 1 && (e.rowSpan ?? 1) === 1)
        )
      }
    }
  }

  clearFootprint(defaultEntrance)
  clearFootprint(defaultExit)

  withoutDoors.push({
    ...defaultEntrance,
    id: entrance?.id ?? defaultEntrance.id,
    locked: entrance?.locked,
  })
  withoutDoors.push({
    ...defaultExit,
    id: exit?.id ?? defaultExit.id,
    locked: exit?.locked,
  })

  return withoutDoors
}

/** Refresh perimeter aisles/doors when the entrance wall setting changes; keep interior fixtures. */
export function refreshPerimeterForEntranceWall(
  elements: VenueElement[],
  entranceWall: WallSide,
  cols: number,
  rows: number
): VenueElement[] {
  const defaults = buildDefaultVenueElements(entranceWall, cols, rows)
  const interior = elements.filter((e) => {
    if (e.type === 'entrance' || e.type === 'exit' || e.type === 'aisle') return false
    return wallAtCell(e.row, e.col, cols, rows) === null
  })
  return [...defaults, ...interior]
}

/** Guarantee exactly one entrance and one exit on outer walls (merges default aisles/doors if missing). */
export function ensureEntranceAndExit(
  elements: VenueElement[],
  entrance: WallSide,
  cols: number,
  rows: number
): VenueElement[] {
  if (cols < 1 || rows < 1) return elements

  const hasEntrance = elements.some((e) => e.type === 'entrance')
  const hasExit = elements.some((e) => e.type === 'exit')
  if (hasEntrance && hasExit) return elements

  const defaults = buildDefaultVenueElements(entrance, cols, rows)
  if (!hasEntrance && !hasExit) return defaults

  const withoutDoors = elements.filter((e) => e.type !== 'entrance' && e.type !== 'exit')
  const shellParts = defaults.filter(
    (e) =>
      e.type === 'entrance' ||
      e.type === 'exit' ||
      e.type === 'aisle' ||
      (e.type === 'column' && wallAtCell(e.row, e.col, cols, rows) !== null)
  )
  const custom = withoutDoors.filter(
    (e) => e.type !== 'aisle' && wallAtCell(e.row, e.col, cols, rows) === null
  )
  return [...shellParts, ...custom]
}

export type VenueGridBounds = { cols: number; rows: number }

/** Structural shell nodes that must survive fixture clears and eraser wipes. */
export function isImmutableVenueElement(
  el: VenueElement,
  cols: number,
  rows: number
): boolean {
  if (el.locked) return true

  if (isPerimeterWallElement(el, cols, rows)) return true

  if (el.type === 'entrance' || el.type === 'exit' || el.type === 'door') {
    return wallAtCell(el.row, el.col, cols, rows) !== null
  }

  if (el.type === 'stage') return true

  /** Off-floor annex band (e.g. Kilkenny Raised Stage / Stage Stairs at row >= hallRows). */
  if (el.row >= rows) return true

  if (el.type === 'column' && wallAtCell(el.row, el.col, cols, rows) !== null) {
    return true
  }

  const label = (el.label ?? '').trim()
  if (/^(Perimeter wall|Raised Stage|Stage Stairs|Main Entrance|Emergency Exit)$/i.test(label)) {
    return true
  }

  return isStructuralShellElement(el, cols, rows)
}

function elementIsProtected(
  el: VenueElement | undefined,
  grid?: VenueGridBounds
): boolean {
  if (!el) return false
  return !canRemoveVenueElement(el, grid)
}

/** Labels stamped by auto-plan layout preset shell painters (eraser-removable). */
const LAYOUT_PRESET_PAINT_LABELS = new Set([
  'Entrance orientation',
  'Angled corner',
  'Entrance threshold',
  'Exit buffer',
  'Shared aisle',
  'Row aisle',
  'Serpentine flow',
  'Anchor approach',
  'Pedestrian walkway',
  'Cross flow',
  'Vertical aisle',
  'Horizontal aisle',
])

/**
 * True for corridor / preset shell paint that should stay editable — not perimeter walls or annex stage.
 * These render on the interactive layer so coordinators can erase individual cells or blocks.
 */
export function isLayoutPresetPaintedElement(
  el: VenueElement,
  cols: number,
  rows: number
): boolean {
  const label = (el.label ?? '').trim()
  if (LAYOUT_PRESET_PAINT_LABELS.has(label)) return true
  if (/ anchor zone$/i.test(label)) return true

  if (el.type === 'aisle' && el.locked && !isStructuralShellElement(el, cols, rows)) {
    return true
  }

  if (
    (el.type === 'food_court' || el.type === 'restroom' || el.type === 'stage') &&
    /anchor zone/i.test(label) &&
    !isImmutableVenueElement(el, cols, rows)
  ) {
    return true
  }

  return false
}

/** Whether the eraser / Remove tool may delete this fixture (preset paint, user paint, co-aisles). */
export function canRemoveVenueElement(
  el: VenueElement | undefined,
  grid?: VenueGridBounds
): boolean {
  if (!el) return false
  if (isCoGeneratedBoothAisle(el)) return true
  if (!grid) return !el.locked
  if (isLayoutPresetPaintedElement(el, grid.cols, grid.rows)) return true
  if (isImmutableVenueElement(el, grid.cols, grid.rows)) return false
  return true
}

export function removeVenueElementById(
  elements: VenueElement[],
  elementId: string,
  grid?: VenueGridBounds
): VenueElement[] {
  const target = elements.find((e) => e.id === elementId)
  if (!target || !canRemoveVenueElement(target, grid)) return elements
  return elements.filter((e) => e.id !== elementId)
}

export function isFixtureLocked(el: VenueElement | undefined): boolean {
  return el?.locked === true
}

export function removeElementsAt(
  elements: VenueElement[],
  row: number,
  col: number,
  grid?: VenueGridBounds
): VenueElement[] {
  const target = getElementAt(elements, row, col)
  if (!target || elementIsProtected(target, grid)) return elements
  return elements.filter((e) => e.id !== target.id)
}

export function placeElement(
  elements: VenueElement[],
  row: number,
  col: number,
  type: VenueElementType,
  label?: string,
  grid?: VenueGridBounds
): VenueElement[] {
  const existing = getElementAt(elements, row, col)
  if (elementIsProtected(existing, grid)) return elements

  const without = removeElementsAt(elements, row, col, grid)
  return [
    ...without,
    {
      id: crypto.randomUUID(),
      type,
      row,
      col,
      colSpan: 1,
      rowSpan: 1,
      label: label?.trim() || undefined,
      locked: false,
    },
  ]
}

export function toggleElementLock(
  elements: VenueElement[],
  row: number,
  col: number
): VenueElement[] {
  const target = getElementAt(elements, row, col)
  if (!target) return elements
  return toggleElementLockById(elements, target.id)
}

export function toggleElementLockById(
  elements: VenueElement[],
  elementId: string
): VenueElement[] {
  return elements.map((e) =>
    e.id === elementId ? { ...e, locked: !e.locked } : e
  )
}

export function setAllFixturesLocked(
  elements: VenueElement[],
  locked: boolean
): VenueElement[] {
  return elements.map((e) => ({ ...e, locked }))
}

export function countLockedFixtures(elements: VenueElement[]): number {
  return elements.filter((e) => e.locked).length
}

/** Paired shopper aisles created when placing booths on the 1′ co-plan grid. */
export function isCoGeneratedBoothAisle(el: VenueElement): boolean {
  return el.type === 'aisle' && (el.label?.startsWith('Aisle · Booth') ?? false)
}

/** Perimeter doors/walls from a template shell (kept when older layouts lack locked flags). */
export function isStructuralShellElement(
  el: VenueElement,
  cols: number,
  rows: number
): boolean {
  if (el.type === 'entrance' || el.type === 'exit' || el.type === 'door') {
    return wallAtCell(el.row, el.col, cols, rows) !== null
  }
  if (el.type === 'column') {
    return wallAtCell(el.row, el.col, cols, rows) !== null
  }
  if (el.type === 'aisle' && el.locked && (el.colSpan ?? 1) === 1 && (el.rowSpan ?? 1) === 1) {
    const midCol = Math.floor(cols / 2)
    const midRow = Math.floor(rows / 2)
    if (el.col === midCol || el.row === midRow) return true
  }
  return false
}

/** Remove user-painted decorations; keep immutable architectural shell. */
export function clearRemovableFixtures(
  venueElements: VenueElement[],
  cols: number,
  rows: number
): VenueElement[] {
  return venueElements.filter((el) => isImmutableVenueElement(el, cols, rows))
}

/** Remove vendors and user-painted fixtures; keep locked template/shell elements. */
export function clearUserPlacedLayout(
  venueElements: VenueElement[],
  cols: number,
  rows: number
): VenueElement[] {
  return venueElements.filter((el) => {
    if (isCoGeneratedBoothAisle(el)) return false
    return isImmutableVenueElement(el, cols, rows)
  })
}

export function paintCells(
  elements: VenueElement[],
  cells: { row: number; col: number }[],
  type: VenueElementType | 'eraser',
  label?: string,
  grid?: VenueGridBounds
): VenueElement[] {
  let next = elements
  for (const { row, col } of cells) {
    const existing = getElementAt(next, row, col)
    if (elementIsProtected(existing, grid)) continue

    if (type === 'eraser') {
      next = removeElementsAt(next, row, col, grid)
    } else {
      next = placeElement(next, row, col, type, label, grid)
    }
  }
  return next
}
