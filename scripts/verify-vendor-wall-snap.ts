/**
 * Vendor booth wall snap — within 3′ threshold, rear flush + inward rotation.
 *
 * Run: npx tsx scripts/verify-vendor-wall-snap.ts
 */

import {
  boothClampDeltaForRoom,
  footprintWithinBounds,
  resolveRoomPlacementBounds,
  VENDOR_WALL_INSET_FT,
} from '../lib/floor-plan/boundary-constraints'
import {
  snapVendorBoothToPerimeter,
  VENDOR_WALL_SNAP_THRESHOLD_FT,
} from '../components/coordinator/floor-plan-v2/interactions/vendor-booth-placement'
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

function vendorBooth(x: number, y: number, rotation = 0): BoothObject {
  return {
    id: 'vb-1',
    kind: 'booth',
    x,
    y,
    width: 6,
    height: 4,
    rotation,
    label: 'Vendor',
    tablePurpose: 'vendor',
    tableShape: 'rectangular',
  }
}

// Booth 2′ from top wall inner line — should snap flush with rotation 0 (faces inward).
const nearTop = vendorBooth(22, 5 + 2)
const snapTop = snapVendorBoothToPerimeter(nearTop, doc)
assert(snapTop !== null, 'Expected snap within 3′ of top wall')
assert(
  Math.abs(snapTop!.y - (5 + VENDOR_WALL_INSET_FT)) < 0.01,
  `Top snap y=${snapTop!.y} expected ${5 + VENDOR_WALL_INSET_FT}`
)
assert(snapTop!.rotation === 0, `Top snap rotation=${snapTop!.rotation} expected 0`)

// Booth 4′ from top wall — should NOT snap (beyond 3′ threshold).
const farTop = vendorBooth(22, 5 + 4)
assert(
  snapVendorBoothToPerimeter(farTop, doc) === null,
  'Should not snap when >3′ from wall'
)

// Drag clamp must allow approaching within snap threshold (was 4′ inset — blocked snap).
doc.objectRoom = { 'vb-1': roomId }
const dragProbe = vendorBooth(22, 5 + VENDOR_WALL_INSET_FT + 2)
const clamp = boothClampDeltaForRoom(dragProbe, doc, roomId)
assert(
  clamp.dx === 0 && clamp.dy === 0,
  `Vendor drag clamp should allow 2′+inset from wall, got dx=${clamp.dx} dy=${clamp.dy}`
)

// Snapped position must pass boundary validation (was failing at 4′ inset).
const bounds = resolveRoomPlacementBounds(doc, roomId)!
const snappedBooth = { ...nearTop, ...snapTop! }
assert(
  footprintWithinBounds(snappedBooth, bounds),
  'Snapped vendor booth must pass footprintWithinBounds'
)

assert(
  VENDOR_WALL_SNAP_THRESHOLD_FT === 3,
  'Snap threshold must remain 3′'
)

console.log('verify-vendor-wall-snap: all checks passed')
