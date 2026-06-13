/**
 * Manual placement row/column orientation — straight layouts default horizontal.
 *
 * Run: npx tsx scripts/verify-booth-row-orientation.ts
 */

import {
  detectVendorManualLayoutOrganization,
  findVendorBoothRowPeer,
  vendorBoothHorizontalLayoutOrientation,
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

const colA = vendor('col-a', 40, 10, 90)
const colB = vendor('col-b', 40, 18, 90)
const colCandidate = vendor('col-c', 40, 26, 0)
assert(
  detectVendorManualLayoutOrganization([colA, colB], undefined, null, {
    probe: colCandidate,
  }) === 'vertical-column',
  'Three aligned centers on X should read as a vertical column layout'
)
const horizontalDefault = vendorBoothHorizontalLayoutOrientation(colCandidate)
assert(
  horizontalDefault.rotation === 0,
  `Vertical manual layout should default to horizontal table length, got rotation ${horizontalDefault.rotation}`
)
assert(
  horizontalDefault.width === 6 && horizontalDefault.height === 4,
  'Horizontal default should keep long edge on width'
)

assert(
  detectVendorManualLayoutOrganization([rowA, rowB], undefined, null, {
    probe: candidate,
  }) === 'horizontal-row',
  'Row-aligned booths should read as horizontal-row layout'
)

console.log('verify-booth-row-orientation: all checks passed')
