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
  orientVendorBoothToNearestWall,
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

// Booth 2′ from left (west) wall — snap flush at room originX.
const nearLeft = vendorBooth(10 + 2, 18, 0)
nearLeft.id = 'vb-left'
doc.objectRoom = { 'vb-left': roomId }
const snapLeft = snapVendorBoothToPerimeter(nearLeft, doc)
assert(snapLeft !== null, 'Expected snap within 3′ of west wall')
assert(
  Math.abs(snapLeft!.x - 10) < 0.01,
  `West snap x=${snapLeft!.x} expected 10 (flush originX)`
)
assert(snapLeft!.rotation === 270, `West snap rotation=${snapLeft!.rotation} expected 270`)

// Drag clamp must not block vendor booths within 3′ of west wall (regression was 4′).
const westProbe = vendorBooth(10 + 2, 18, 270)
westProbe.id = 'vb-west-clamp'
westProbe.width = 6
westProbe.height = 4
doc.objectRoom = { 'vb-west-clamp': roomId }
const westClamp = boothClampDeltaForRoom(westProbe, doc, roomId)
assert(
  westClamp.dx === 0 && westClamp.dy === 0,
  `Vendor west clamp should allow approach, got dx=${westClamp.dx} dy=${westClamp.dy}`
)

// Booth 3.5′ from top wall — inside 4′ snap band, must snap flush (not bounce to grid).
const inSnapBand = vendorBooth(22, 5 + 3.5)
const snapBand = snapVendorBoothToPerimeter(inSnapBand, doc)
assert(snapBand !== null, 'Expected snap within 4′ wall band')
assert(
  Math.abs(snapBand!.y - (5 + VENDOR_WALL_INSET_FT)) < 0.01,
  `Snap band y=${snapBand!.y} expected flush ${5 + VENDOR_WALL_INSET_FT}`
)

// Booth 2′ from top wall inner line — should snap flush with rotation 0 (faces inward).
const nearTop = vendorBooth(22, 5 + 2)
const snapTop = snapVendorBoothToPerimeter(nearTop, doc)
assert(snapTop !== null, 'Expected snap within 3′ of top wall')
assert(
  Math.abs(snapTop!.y - (5 + VENDOR_WALL_INSET_FT)) < 0.01,
  `Top snap y=${snapTop!.y} expected ${5 + VENDOR_WALL_INSET_FT}`
)
assert(snapTop!.rotation === 0, `Top snap rotation=${snapTop!.rotation} expected 0`)

// Booth exactly 4′ from top wall — at clearance target; must NOT snap flush.
const atFourFt = vendorBooth(22, 5 + 4)
atFourFt.id = 'vb-four-ft'
doc.objectRoom = { 'vb-four-ft': roomId }
assert(
  snapVendorBoothToPerimeter(atFourFt, doc) === null,
  'Should not snap when exactly 4′ from wall (clean clearance target)'
)

// Booth 5′ from top wall — beyond 4′ threshold; position-only snap must not fire.
const farTop = vendorBooth(22, 5 + 5)
assert(
  snapVendorBoothToPerimeter(farTop, doc) === null,
  'Should not snap when >4′ from wall'
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
  VENDOR_WALL_SNAP_THRESHOLD_FT === 4,
  'Snap threshold must remain 4′ (wall overrides grid in dead zone)'
)

// Swapped dimensions (2×6 storage) must still orient long edge toward nearest wall.
doc.objectRoom = { 'vb-swapped': roomId }
const swapped = vendorBooth(11, 20, 0)
swapped.id = 'vb-swapped'
swapped.width = 2
swapped.height = 6
swapped.tableLengthFt = 6
const orientedSwapped = orientVendorBoothToNearestWall(swapped, doc)
assert(orientedSwapped !== null, 'Expected orientation toward nearest wall')
assert(
  orientedSwapped!.width === 6 && orientedSwapped!.height === 2,
  `Swapped booth should normalize to 6×2, got ${orientedSwapped!.width}×${orientedSwapped!.height}`
)
assert(
  orientedSwapped!.rotation === 270,
  `Left-biased booth should face left wall (270°), got ${orientedSwapped!.rotation}`
)

// Beyond snap threshold, orientation-only still applies (no position snap).
const interior = vendorBooth(25, 18, 0)
interior.id = 'vb-interior'
doc.objectRoom = { 'vb-interior': roomId }
assert(
  snapVendorBoothToPerimeter(interior, doc) === null,
  'Should not position-snap when >3′ from wall'
)
const orientedInterior = orientVendorBoothToNearestWall(interior, doc)
assert(orientedInterior !== null, 'Expected wall-facing rotation beyond snap threshold')
assert(
  orientedInterior!.rotation === 0,
  `Top-nearest interior booth should rotate toward top wall (0°), got ${orientedInterior!.rotation}`
)
assert(
  orientedInterior!.width === 6 && orientedInterior!.height === 4,
  'Interior booth keeps long edge in width after orient'
)

console.log('verify-vendor-wall-snap: all checks passed')
