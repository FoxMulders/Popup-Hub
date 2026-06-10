/**
 * Manual placement row orientation — inherit wall facing from row peers.
 *
 * Run: npx tsx scripts/verify-booth-row-orientation.ts
 */

import {
  findVendorBoothRowPeer,
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

console.log('verify-booth-row-orientation: all checks passed')
