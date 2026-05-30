/**
 * Verifies Outside-only (perimeter) auto-layout: ring placement, outward-facing
 * storefronts, and 4′ core separation between booths.
 *
 * Run: npx tsx scripts/verify-perimeter-layout.ts
 */

import { autoLayout } from '../lib/booth-planner/algorithm'
import { applyOutsideOnlyLayout } from '../lib/booth-planner/outside-only-layout'
import { isPerimeterPlacement } from '../lib/booth-planner/layout-presets'
import {
  PERIMETER_VENDING_MARGIN_CELLS,
  isPerimeterVendingLaneCell,
} from '../lib/booth-planner/perimeter-clearance'
import {
  pickPrimaryPerimeterWall,
  storefrontSideForPerimeterWall,
  touchingPerimeterWalls,
} from '../lib/booth-planner/perimeter-orientation'
import { facingTargetForStorefrontSide } from '../lib/booth-planner/facing-target'
import { BOOTH_CORE_SEPARATION_CELLS } from '../lib/booth-planner/layout-clearance-constants'
import { gridSpansForTableOrientation } from '../lib/booth-planner/table-orientation'

const COLS = 40
const ROWS = 72
const TABLE_FT = 6

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const shell = applyOutsideOnlyLayout(COLS, ROWS, 'south')
const spans = gridSpansForTableOrientation(TABLE_FT, 'one_foot', 'horizontal')
const vendorCount = 28
const vendors = Array.from({ length: vendorCount }, (_, i) => ({
  id: `v${i}`,
  vendorName: `Vendor ${i}`,
  categoryName: i % 2 === 0 ? 'Makers' : 'Food',
  categoryColor: '#2D5A27',
  colSpan: spans.colSpan,
  rowSpan: spans.rowSpan,
  tableLengthFt: TABLE_FT,
}))

const result = autoLayout({
  venueWidth: COLS,
  venueLength: ROWS,
  boothWidth: 1,
  boothLength: 1,
  entrance: 'south',
  venueElements: shell.venue_elements,
  vendors,
  preset: 'perimeter',
})

const placed = result.cells.filter((c) => c.col >= 0)
assert(placed.length >= 8, `Expected >=8 placed, got ${placed.length}`)

for (const cell of placed) {
  assert(
    isPerimeterPlacement(cell.row, cell.col, cell.rowSpan, cell.colSpan, ROWS, COLS),
    `Booth ${cell.id} not in perimeter lane`
  )
  const walls = touchingPerimeterWalls(
    cell.row,
    cell.col,
    cell.rowSpan,
    cell.colSpan,
    ROWS,
    COLS
  )
  assert(walls.length > 0, `Booth ${cell.id} does not touch a perimeter wall band`)
  const expectedStorefront = storefrontSideForPerimeterWall(pickPrimaryPerimeterWall(walls))
  const facing = facingTargetForStorefrontSide(expectedStorefront)
  assert(
    cell.facingTarget === facing,
    `Booth ${cell.id} facing ${cell.facingTarget} expected ${facing} (walls=${walls.join(',')})`
  )
}

for (let i = 0; i < placed.length; i++) {
  for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i]!
    const b = placed[j]!
    const rowGap =
      a.row + a.rowSpan - 1 < b.row
        ? b.row - (a.row + a.rowSpan - 1) - 1
        : b.row + b.rowSpan - 1 < a.row
          ? a.row - (b.row + b.rowSpan - 1) - 1
          : -1
    const colGap =
      a.col + a.colSpan - 1 < b.col
        ? b.col - (a.col + a.colSpan - 1) - 1
        : b.col + b.colSpan - 1 < a.col
          ? a.col - (b.col + b.colSpan - 1) - 1
          : -1
    const rowsOverlap = !(a.row + a.rowSpan - 1 < b.row || b.row + b.rowSpan - 1 < a.row)
    const colsOverlap = !(a.col + a.colSpan - 1 < b.col || b.col + b.colSpan - 1 < a.col)
    if (rowsOverlap && colsOverlap) {
      throw new Error(`Overlap ${a.id} ${b.id}`)
    }
    if (rowsOverlap && colGap >= 0 && colGap < BOOTH_CORE_SEPARATION_CELLS) {
      throw new Error(
        `Col gap ${colGap} < ${BOOTH_CORE_SEPARATION_CELLS} between ${a.id} and ${b.id}`
      )
    }
    if (colsOverlap && rowGap >= 0 && rowGap < BOOTH_CORE_SEPARATION_CELLS) {
      throw new Error(
        `Row gap ${rowGap} < ${BOOTH_CORE_SEPARATION_CELLS} between ${a.id} and ${b.id}`
      )
    }
  }
}

const wallBands = new Set(placed.map((c) => pickPrimaryPerimeterWall(
  touchingPerimeterWalls(c.row, c.col, c.rowSpan, c.colSpan, ROWS, COLS)
)))
assert(wallBands.has('south') && wallBands.size >= 2, `Expected multi-wall ring, got ${[...wallBands].join(',')}`)
assert(
  isPerimeterVendingLaneCell(1, 10, COLS, ROWS),
  'Concourse cell should remain in vending lane'
)

console.log(
  `PASS  perimeter layout: placed=${placed.length}/${vendorCount} ` +
    `margin=${PERIMETER_VENDING_MARGIN_CELLS}ft separation=${BOOTH_CORE_SEPARATION_CELLS}ft`
)
