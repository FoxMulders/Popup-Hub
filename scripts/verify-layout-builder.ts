/**
 * Smoke tests for layout-builder placement + void safeguard.
 * Run: npx tsx scripts/verify-layout-builder.ts
 */

import {
  ensureLayoutNotVoid,
  isValidPlacementLocation,
  layoutRooms,
  makeDefaultMainHall,
} from '../components/coordinator/floor-plan-v2/state/layout-builder-core'
import type { FloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/types'

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

const empty: FloorPlanDoc = {
  canvasWidthFt: 100,
  canvasLengthFt: 100,
  gridSpacingFt: 1,
  snapFt: 1,
  objects: [],
  rooms: [],
}

const safeguarded = ensureLayoutNotVoid(empty)
assert(layoutRooms(safeguarded).length === 1, 'void safeguard injects Main Hall')
assert(
  isValidPlacementLocation(safeguarded, { x: 25, y: 25 }),
  'center of Main Hall accepts placement'
)
assert(
  !isValidPlacementLocation(safeguarded, { x: -5, y: -5 }),
  'outside hall rejects placement'
)

const hall = makeDefaultMainHall()
const withHall: FloorPlanDoc = { ...empty, rooms: [hall] }
assert(
  isValidPlacementLocation(withHall, { x: 1, y: 1 }),
  'inside rect hall'
)
assert(
  !isValidPlacementLocation(withHall, { x: 200, y: 200 }),
  'background grid rejects'
)

console.log('verify-layout-builder: ok')
