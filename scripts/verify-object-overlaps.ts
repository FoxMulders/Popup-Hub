/**
 * Smoke test for floor-plan-v2 object overlap detection.
 */

import {
  detectPlacedObjectOverlaps,
  findOverlapInMove,
  placedObjectsClearanceOverlap,
  placedObjectsOverlap,
} from '../components/coordinator/floor-plan-v2/interactions/geometry'
import {
  vendorBoothBoundaryWarningBand,
} from '../lib/coordinator/booth-clearance-visual'
import type {
  BoothObject,
  PlacedObject,
} from '../components/coordinator/floor-plan-v2/state/types'
import {
  createTableCluster,
  syncBoothCompoundBounds,
} from '../components/coordinator/floor-plan-v2/state/table-cluster-layout'

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
      return { ...base, kind: 'booth', accentColor: null, tablePurpose: 'guest' }
    case 'wall':
      return { ...base, kind: 'wall' }
    case 'door':
      return { ...base, kind: 'door', doorType: 'entrance' }
    case 'emergency_exit':
      return { ...base, kind: 'emergency_exit', label: 'EXIT' }
    case 'stage':
      return { ...base, kind: 'stage' }
    default:
      return { ...base, kind: 'label', text: 'Test' }
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

console.log('placedObjectsOverlap — staggered vendors with 3′ buffers do not false-flag')
{
  function vendor(id: string, x: number, y: number): PlacedObject {
    return {
      id,
      kind: 'booth',
      x,
      y,
      width: 6,
      height: 4,
      rotation: 0,
      accentColor: null,
      tablePurpose: 'vendor',
    }
  }
  const bottomLeft = vendor('bl', 0, 12)
  const middle = vendor('mid', 8, 8)
  const topLeft = vendor('top', 0, 0)
  expect(
    'staggered vendors are not physically overlapping',
    detectPlacedObjectOverlaps([bottomLeft, middle, topLeft]).size,
    0
  )
  expect(
    'clearance probes still collide when aisles are tight',
    placedObjectsClearanceOverlap(bottomLeft, middle),
    true
  )
}

console.log('findOverlapInMove — drag commit gate')
{
  const moved = [obj('a', 'booth', 10, 10)]
  const others = [obj('b', 'stage', 12, 12)]
  expect('move landing on obstacle is blocked', findOverlapInMove(moved, others), true)
  expect('clear move is allowed', findOverlapInMove([obj('a', 'booth', 0, 0)], others), false)
}

console.log('grid vendors — physical overlap vs boundary warnings')
{
  function vendor(id: string, x: number, y: number): PlacedObject {
    return {
      id,
      kind: 'booth',
      x,
      y,
      width: 6,
      height: 2,
      rotation: 0,
      accentColor: null,
      tablePurpose: 'vendor',
    }
  }
  const booths = [
    vendor('a', 0, 0),
    vendor('b', 9, 0),
    vendor('c', 0, 8),
    vendor('d', 9, 8),
  ]
  expect(
    '3′ edge gap does not physically overlap',
    detectPlacedObjectOverlaps(booths).size,
    0
  )
  expect(
    '3′ vendor spacing is not a boundary warning',
    vendorBoothBoundaryWarningBand(booths[0] as BoothObject, booths, [], {}),
    'good'
  )
  expect(
    'clearance probes still collide when aisles are tight',
    placedObjectsClearanceOverlap(booths[0]!, booths[1]!),
    true
  )
}

console.log('table cluster — parent W×H used for overlap, not sub-table probes')
{
  const cluster = createTableCluster('3x6')
  function clusteredVendor(id: string, x: number, y: number): BoothObject {
    const booth = syncBoothCompoundBounds({
      id,
      kind: 'booth',
      x,
      y,
      width: 6,
      height: 2,
      rotation: 0,
      accentColor: null,
      tablePurpose: 'vendor',
      tableCluster: cluster,
      tableCount: cluster.subTables.length,
      tableLengthFt: cluster.tableLengthFt,
    })
    return booth
  }
  const left = clusteredVendor('left', 0, 0)
  const right = clusteredVendor('right', left.width + 2, 0)
  expect(
    'adjacent clustered vendors with 2′ parent gap do not overlap',
    detectPlacedObjectOverlaps([left, right]).size,
    0
  )
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll object overlap checks passed.')
