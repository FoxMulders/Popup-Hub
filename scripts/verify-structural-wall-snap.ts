/**
 * Regression tests for door/emergency-exit wall snap:
 * - long edge runs along the wall tangent
 * - short edge is wall depth
 * - doors skip booth placement rules (nearest-room resolution)
 */

import { rotatedAabb } from '../components/coordinator/floor-plan-v2/interactions/geometry'
import {
  findRoomIdForStructuralPlacement,
  orientLongEdgeAlongWall,
  snapStructuralAssetToLocalPerimeter,
} from '../components/coordinator/floor-plan-v2/interactions/structural-wall-snap'
import {
  isValidObjectPlacement,
  resolvePlacementRoomIdForObject,
} from '../components/coordinator/floor-plan-v2/geometry/is-point-in-room'
import type { FloorPlanDoc, PlacedObject } from '../components/coordinator/floor-plan-v2/state/types'

let failed = 0
function expect(label: string, condition: boolean) {
  const ok = Boolean(condition)
  console.log(`${ok ? '  PASS' : '  FAIL'} - ${label}`)
  if (!ok) failed++
}

function doorProbe(
  x: number,
  y: number,
  w: number,
  h: number,
  rotation = 0
): PlacedObject {
  return {
    id: 'd1',
    kind: 'door',
    doorType: 'entrance',
    x,
    y,
    width: w,
    height: h,
    rotation,
  } as PlacedObject
}

function longEdgeAlongWall(
  aabb: { width: number; height: number },
  side: 'horizontal' | 'vertical'
): boolean {
  if (side === 'horizontal') return aabb.width >= aabb.height
  return aabb.height >= aabb.width
}

console.log('orientLongEdgeAlongWall — swaps when height > width')
{
  const o = orientLongEdgeAlongWall(1, 4)
  expect('swaps to 4×1', o.width === 4 && o.height === 1)
  const same = orientLongEdgeAlongWall(3, 1)
  expect('keeps 3×1', same.width === 3 && same.height === 1)
}

console.log('snap — horizontal top wall (long edge along X)')
{
  const roomW = 40
  const roomH = 30
  const snapped = snapStructuralAssetToLocalPerimeter(
    doorProbe(10, 5, 1, 4),
    roomW,
    roomH
  )
  const aabb = rotatedAabb({ ...doorProbe(0, 0, 1, 1), ...snapped } as PlacedObject)
  expect('rotation 0', snapped.rotation === 0)
  expect('local width is long span', (snapped.width ?? 0) >= (snapped.height ?? 0))
  expect('flush to top (y=0)', Math.abs(aabb.y) < 1e-6)
  expect('long edge horizontal', longEdgeAlongWall(aabb, 'horizontal'))
  expect('span is 4ft along wall', Math.abs(aabb.width - 4) < 1e-6)
  expect('depth is 1ft', Math.abs(aabb.height - 1) < 1e-6)
}

console.log('snap — vertical left wall (long edge along Y)')
{
  const roomW = 40
  const roomH = 30
  const snapped = snapStructuralAssetToLocalPerimeter(
    doorProbe(5, 12, 4, 1),
    roomW,
    roomH
  )
  const aabb = rotatedAabb({ ...doorProbe(0, 0, 1, 1), ...snapped } as PlacedObject)
  expect('rotation 90', snapped.rotation === 90)
  expect('local width is long span', (snapped.width ?? 0) >= (snapped.height ?? 0))
  expect('flush to left (x=0)', Math.abs(aabb.x) < 1e-6)
  expect('long edge vertical', longEdgeAlongWall(aabb, 'vertical'))
  expect('span is 4ft along wall', Math.abs(aabb.height - 4) < 1e-6)
  expect('depth is 1ft', Math.abs(aabb.width - 1) < 1e-6)
}

console.log('snap — vertical left wall from tall draw rect')
{
  const snapped = snapStructuralAssetToLocalPerimeter(
    doorProbe(8, 10, 1, 5),
    40,
    30
  )
  const aabb = rotatedAabb({ ...doorProbe(0, 0, 1, 1), ...snapped } as PlacedObject)
  expect('swapped to 5×1 local', snapped.width === 5 && snapped.height === 1)
  expect('rotation 90 for left wall', snapped.rotation === 90)
  expect('long edge vertical', longEdgeAlongWall(aabb, 'vertical'))
}

console.log('placement — doors skip booth interior centroid rule')
{
  const doc: FloorPlanDoc = {
    canvasWidthFt: 60,
    canvasLengthFt: 50,
    gridSpacingFt: 1,
    snapFt: 1,
    rooms: [
      {
        id: 'main',
        name: 'Main Hall',
        originX: 5,
        originY: 5,
        widthFt: 40,
        lengthFt: 30,
      },
    ],
    objects: [],
    objectRoom: {},
  }
  const snapped = snapStructuralAssetToLocalPerimeter(
    { kind: 'door', x: 15, y: 0, width: 3, height: 1, rotation: 0 },
    40,
    30
  )
  const probe = {
    kind: 'door' as const,
    x: 5 + snapped.x!,
    y: 5 + snapped.y!,
    width: snapped.width ?? 3,
    height: snapped.height ?? 1,
    rotation: snapped.rotation ?? 0,
  }
  const roomId = resolvePlacementRoomIdForObject(doc, probe, 'main')
  expect('resolves nearest room', roomId === 'main')
  expect(
    'valid without interior centroid',
    isValidObjectPlacement(doc, probe, roomId)
  )
  expect(
    'structural placement near outside edge resolves room',
    findRoomIdForStructuralPlacement(doc, { x: 25, y: 2 }, 'main') === 'main'
  )
}

if (failed > 0) {
  console.log(`\n${failed} assertion(s) FAILED`)
  process.exit(1)
}
console.log('\nAll structural wall snap assertions passed.')
