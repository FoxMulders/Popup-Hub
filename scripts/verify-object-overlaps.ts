/**
 * Smoke test for floor-plan-v2 object overlap detection.
 */

import {
  detectPlacedObjectOverlaps,
  findOverlapInMove,
  placedObjectsOverlap,
} from '../components/coordinator/floor-plan-v2/interactions/geometry'
import type { PlacedObject } from '../components/coordinator/floor-plan-v2/state/types'

let failed = 0
function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? '  PASS' : '  FAIL'} - ${label}`)
  if (!ok) {
    console.log(`    expected: ${JSON.stringify(expected)}`)
    console.log(`    actual:   ${JSON.stringify(actual)}`)
    failed++
  }
}

function obj(
  id: string,
  kind: PlacedObject['kind'],
  x: number,
  y: number,
  w = 6,
  h = 6,
  rotation = 0
): PlacedObject {
  const base = { id, kind, x, y, width: w, height: h, rotation }
  switch (kind) {
    case 'booth':
      return { ...base, kind: 'booth', accentColor: null }
    case 'wall':
      return { ...base, kind: 'wall' }
    case 'door':
      return { ...base, kind: 'door', doorType: 'entrance' }
    case 'emergency_exit':
      return { ...base, kind: 'emergency_exit', label: 'EXIT' }
    case 'stage':
      return { ...base, kind: 'stage' }
    default:
      return { ...base, kind: 'aisle' }
  }
}

console.log('placedObjectsOverlap — axis-aligned intersection')
{
  const a = obj('a', 'booth', 0, 0)
  const b = obj('b', 'booth', 3, 3)
  const c = obj('c', 'booth', 6, 0)
  expect('overlapping booths intersect', placedObjectsOverlap(a, b), true)
  expect('flush edge does not intersect', placedObjectsOverlap(a, c), false)
}

console.log('placedObjectsOverlap — door on wall is allowed')
{
  const wall = obj('w', 'wall', 0, 0, 20, 1)
  const door = obj('d', 'door', 5, 0, 3, 1)
  expect('door overlapping wall is skipped', placedObjectsOverlap(wall, door), false)
}

console.log('detectPlacedObjectOverlaps — static layout scan')
{
  const objects = [obj('a', 'booth', 0, 0), obj('b', 'stage', 2, 2), obj('c', 'booth', 20, 20)]
  const ids = detectPlacedObjectOverlaps(objects)
  expect('flags both overlapping ids', [...ids].sort(), ['a', 'b'])
}

console.log('findOverlapInMove — drag commit gate')
{
  const moved = [obj('a', 'booth', 10, 10)]
  const others = [obj('b', 'stage', 12, 12)]
  expect('move landing on obstacle is blocked', findOverlapInMove(moved, others), true)
  expect('clear move is allowed', findOverlapInMove([obj('a', 'booth', 0, 0)], others), false)
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll object overlap checks passed.')
