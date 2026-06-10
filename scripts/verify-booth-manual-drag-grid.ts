/**
 * Manual vendor booth drag — 1′ / 5′ grid steps without perimeter magnet snap.
 *
 * Run: npx tsx scripts/verify-booth-manual-drag-grid.ts
 */

import {
  BOOTH_MOVE_SNAP_FT,
  BOOTH_MOVE_SNAP_SHIFT_FT,
  boothLayoutMovePatch,
  resolveBoothMoveSnapFt,
} from '../components/coordinator/floor-plan-v2/engine/booth-layout-engine'
import type { BoothObject, FloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const roomId = 'room-1'
const doc: FloorPlanDoc = {
  canvasWidthFt: 60,
  canvasLengthFt: 40,
  gridSpacingFt: 1,
  snapFt: 1,
  rooms: [
    {
      id: roomId,
      name: 'Main',
      originX: 10,
      originY: 5,
      widthFt: 40,
      lengthFt: 30,
    },
  ],
  objects: [],
  objectRoom: {},
}

function vendorBooth(x: number, y: number): BoothObject {
  return {
    id: 'vb-1',
    kind: 'booth',
    x,
    y,
    width: 6,
    height: 4,
    rotation: 0,
    label: 'Vendor',
    tablePurpose: 'vendor',
    tableShape: 'rectangular',
  }
}

assert(resolveBoothMoveSnapFt({ docSnapFt: 1 }) === BOOTH_MOVE_SNAP_FT, 'default snap is 1′')
assert(
  resolveBoothMoveSnapFt({ shiftKey: true, docSnapFt: 1 }) === BOOTH_MOVE_SNAP_SHIFT_FT,
  'shift snap is 5′'
)

// Booth 2′ from top wall — drag 1′ toward wall must stay on grid, not flush snap.
const twoFromTop = vendorBooth(22, 5 + 2)
doc.objectRoom = { 'vb-1': roomId }
const origin = { x: twoFromTop.x, y: twoFromTop.y }
const moved = boothLayoutMovePatch(twoFromTop, origin, 0, -1, doc, {
  snapFt: BOOTH_MOVE_SNAP_FT,
  activeRoomId: roomId,
})
assert(
  moved.y === 5 + 1,
  `2′ booth dragged 1′ toward wall should land at y=6, got y=${moved.y}`
)
assert(
  moved.x === twoFromTop.x,
  'along-wall axis should not jump to wall origin'
)

// Booth exactly 4′ from top — small nudge must not magnet to flush wall.
const fourFromTop = vendorBooth(22, 5 + 4)
const fourOrigin = { x: fourFromTop.x, y: fourFromTop.y }
const fourMoved = boothLayoutMovePatch(fourFromTop, fourOrigin, 0, -1, doc, {
  snapFt: BOOTH_MOVE_SNAP_FT,
  activeRoomId: roomId,
})
assert(
  fourMoved.y === 5 + 3,
  `4′ booth nudged 1′ toward wall should land at y=8, got y=${fourMoved.y}`
)

// Shift drag quantizes absolute position to 5′ grid (22 + 5 = 27 → snaps to 25).
const shiftMoved = boothLayoutMovePatch(fourFromTop, fourOrigin, 5, 0, doc, {
  snapFt: BOOTH_MOVE_SNAP_SHIFT_FT,
  activeRoomId: roomId,
})
assert(
  shiftMoved.x === 25,
  `shift drag should snap absolute X to 5′ grid, got x=${shiftMoved.x}`
)

console.log('verify-booth-manual-drag-grid: all checks passed')
