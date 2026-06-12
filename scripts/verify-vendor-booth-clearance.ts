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

// Uniform probe expands 6×4 by 3′ per side → 12×10
const booth = vendor('a', 0, 0)
const probe = vendorBoothUniformCollisionProbe(booth)
assert(probe.width === 12, `width=${probe.width} expected 12`)
assert(probe.height === 10, `height=${probe.height} expected 10`)
assert(probe.x === -3, `x=${probe.x} expected -3`)
assert(probe.y === -3, `y=${probe.y} expected -3`)

// 7′ edge-to-edge gap → no probe overlap (6′ minimum + 1′ buffer)
const a = vendor('a', 0, 0)
const b = vendor('b', 13, 0)
assert(
  !placedObjectsOverlap(a, b, overlapCtx),
  '7′ edge gap should not collide (3′ buffer each side)'
)

// 5′ edge-to-edge gap → probes overlap (<6′ aisle)
const c = vendor('c', 0, 0)
const d = vendor('d', 11, 0)
assert(
  placedObjectsOverlap(c, d, overlapCtx),
  '5′ edge gap should collide with 3′ buffers'
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
  `Wall-snapped probe height=${wallProbe.height} should omit back buffer`
)
assert(
  wallProbe.y === wallSnapped.y,
  'Wall-snapped probe should not expand toward the rear wall'
)

assert(VENDOR_BOOTH_CLEARANCE_FT === 3, 'Per-booth safety buffer must be 3′')

console.log('verify-vendor-booth-clearance: all checks passed')
