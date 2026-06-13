/**
 * Manual placement orientation — inherit unanimous table-length axis from room.
 *
 * Run: npx tsx scripts/verify-booth-row-orientation.ts
 */

import {
  boothTableLengthOrientation,
  detectPlacedTableOrientationPattern,
  findVendorBoothRowPeer,
  vendorBoothLayoutOrientationForAxis,
  vendorBoothOrientationFromRowPeer,
  wallEdgeFromRotation,
} from '../components/coordinator/floor-plan-v2/engine/booth-layout-engine'
import type { BoothObject } from '../components/coordinator/floor-plan-v2/state/types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
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

const rowA = vendor('a', 10, 20, 0)
const rowB = vendor('b', 18, 20, 0)
const candidate = vendor('c', 26, 20, 90)

const peer = findVendorBoothRowPeer(candidate, [rowA, rowB])
assert(peer?.id === 'b', `Expected nearest row peer b, got ${peer?.id}`)

const oriented = vendorBoothOrientationFromRowPeer(candidate, peer!)
assert(oriented.rotation === 0, `Expected rotation 0 matching row, got ${oriented.rotation}`)
assert(
  wallEdgeFromRotation(oriented.rotation) === 'top',
  'Row peer on top wall should face top edge'
)

const offRow = vendor('d', 30, 30, 0)
assert(
  findVendorBoothRowPeer(offRow, [rowA, rowB]) === null,
  'Booth on a different Y should not match row peers'
)

assert(
  boothTableLengthOrientation(vendor('h', 0, 0, 0)) === 'horizontal',
  'Rotation 0 should read as horizontal table length'
)
assert(
  boothTableLengthOrientation(vendor('v', 0, 0, 90)) === 'vertical',
  'Rotation 90 should read as vertical table length'
)

const scatteredHorizontalA = vendor('sh-a', 10, 10, 0)
const scatteredHorizontalB = vendor('sh-b', 30, 40, 180)
assert(
  detectPlacedTableOrientationPattern([scatteredHorizontalA, scatteredHorizontalB], undefined, null) ===
    'horizontal',
  'Scattered booths with the same length axis should read as horizontal pattern'
)

const verticalA = vendor('vert-a', 10, 10, 90)
const verticalB = vendor('vert-b', 40, 30, 90)
assert(
  detectPlacedTableOrientationPattern([verticalA, verticalB], undefined, null) === 'vertical',
  'All vertical booths should read as vertical pattern'
)

const mixedA = vendor('mix-a', 0, 0, 0)
const mixedB = vendor('mix-b', 0, 0, 90)
assert(
  detectPlacedTableOrientationPattern([mixedA, mixedB], undefined, null) === null,
  'Mixed orientations should not produce a pattern'
)

const verticalDefault = vendorBoothLayoutOrientationForAxis(
  vendor('next', 50, 50, 0),
  'vertical'
)
assert(
  verticalDefault.rotation === 90,
  `Vertical pattern should place rotation 90, got ${verticalDefault.rotation}`
)

console.log('verify-booth-row-orientation: all checks passed')
