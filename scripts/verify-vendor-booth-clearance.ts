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

// Uniform probe expands 6×4 by 1.5′ per side → 9×7
const booth = vendor('a', 0, 0)
const probe = vendorBoothUniformCollisionProbe(booth)
assert(probe.width === 9, `width=${probe.width} expected 9`)
assert(probe.height === 7, `height=${probe.height} expected 7`)
assert(probe.x === -1.5, `x=${probe.x} expected -1.5`)
assert(probe.y === -1.5, `y=${probe.y} expected -1.5`)

// 4′ edge-to-edge gap → no probe overlap (3′ aisle + 1′ buffer)
const a = vendor('a', 0, 0)
const b = vendor('b', 10, 0)
assert(
  !placedObjectsOverlap(a, b, overlapCtx),
  '4′ edge gap should not collide (1.5′ buffer each side)'
)

// 2′ edge-to-edge gap → probes overlap (<3′ aisle)
const c = vendor('c', 0, 0)
const d = vendor('d', 8, 0)
assert(
  placedObjectsOverlap(c, d, overlapCtx),
  '2′ edge gap should collide with 1.5′ buffers'
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

assert(VENDOR_BOOTH_CLEARANCE_FT === 1.5, 'Per-booth buffer must be half of 3′ aisle')

console.log('verify-vendor-booth-clearance: all checks passed')
