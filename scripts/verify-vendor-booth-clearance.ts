/**
 * Vendor booth 360° collision buffer — 6′×4′ tests as 10′×8′; wall back exception.
 *
 * Run: npx tsx scripts/verify-vendor-booth-clearance.ts
 */

import {
  checkCollision,
  placedObjectsOverlap,
} from '../components/coordinator/floor-plan-v2/interactions/geometry'
import {
  vendorBoothCollisionProbe,
  vendorBoothUniformCollisionProbe,
  snapVendorBoothToPerimeter,
  VENDOR_BOOTH_CLEARANCE_FT,
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

const overlapCtx = {
  canvasWidthFt: doc.canvasWidthFt,
  canvasLengthFt: doc.canvasLengthFt,
  gridSpacingFt: doc.gridSpacingFt,
  snapFt: doc.snapFt,
  objects: doc.objects,
  rooms: doc.rooms ?? [],
  objectRoom: doc.objectRoom,
}

function vendor(id: string, x: number, y: number, rotation = 0): BoothObject {
  return {
    id,
    kind: 'booth',
    x,
    y,
    width: 6,
    height: 4,
    rotation,
    label: id,
    tablePurpose: 'vendor',
    tableShape: 'rectangular',
  }
}

// Uniform probe expands 6×4 → 10×8
const booth = vendor('a', 0, 0)
const probe = vendorBoothUniformCollisionProbe(booth)
assert(probe.width === 10, `width=${probe.width} expected 10`)
assert(probe.height === 8, `height=${probe.height} expected 8`)
assert(probe.x === -2, `x=${probe.x} expected -2`)
assert(probe.y === -2, `y=${probe.y} expected -2`)

// 4′ table gap → probe edges touch (no overlap)
const a = vendor('a', 0, 0)
const b = vendor('b', 10, 0)
assert(
  !placedObjectsOverlap(a, b, overlapCtx),
  '4′ table gap should not collide (10′ probe span)'
)

// 3′ table gap → probes overlap
const c = vendor('c', 0, 0)
const d = vendor('d', 9, 0)
assert(
  placedObjectsOverlap(c, d, overlapCtx),
  '3′ table gap should collide with 360° buffer'
)

assert(
  checkCollision(c, d, overlapCtx),
  'checkCollision should mirror placedObjectsOverlap'
)

// Wall-snapped top row: back buffer omitted on top edge
doc.objectRoom = { wall: roomId }
const nearWall = vendor('wall', 22, 5 + 2)
const snap = snapVendorBoothToPerimeter(nearWall, doc)
assert(snap !== null, 'Expected wall snap for clearance test')
const wallSnapped = { ...nearWall, ...snap! }
const wallCtx = { ...overlapCtx, objectRoom: doc.objectRoom, objects: [wallSnapped] }
const wallProbe = vendorBoothCollisionProbe(wallSnapped, wallCtx)
const uniformProbe = vendorBoothUniformCollisionProbe(wallSnapped)
assert(
  wallProbe.height < uniformProbe.height,
  `Wall-snapped probe height=${wallProbe.height} should omit 2′ back buffer`
)
assert(
  wallProbe.y === wallSnapped.y,
  'Wall-snapped probe should not expand toward the rear wall'
)

assert(VENDOR_BOOTH_CLEARANCE_FT === 3, 'Clearance must remain 3′')

console.log('verify-vendor-booth-clearance: all checks passed')
