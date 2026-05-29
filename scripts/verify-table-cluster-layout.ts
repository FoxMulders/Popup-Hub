/**
 * Smoke tests for multi-table cluster layout (sub-table rotation + compound bbox).
 * Run: npx tsx scripts/verify-table-cluster-layout.ts
 */

import {
  compoundBoundsFromCluster,
  createBoothWithTableCluster,
  patchBoothSubTableRotation,
  placementProbesForObject,
  syncBoothCompoundBounds,
} from '../components/coordinator/floor-plan-v2/state/table-cluster-layout'
import { placedObjectsOverlap } from '../components/coordinator/floor-plan-v2/interactions/geometry'

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++
    console.log(`  ok: ${msg}`)
  } else {
    failed++
    console.error(`  FAIL: ${msg}`)
  }
}

function approx(a: number, b: number, eps = 0.05) {
  return Math.abs(a - b) <= eps
}

console.log('verify-table-cluster-layout')

const booth = createBoothWithTableCluster('2x5', { x: 20, y: 15 })
assert(booth.tableCluster?.presetId === '2x5', 'preset 2x5')
assert(booth.tableCluster?.subTables.length === 2, 'two sub-tables')
assert(booth.tableCount === 2, 'tableCount synced')

const beforeCenter = { x: booth.x + booth.width / 2, y: booth.y + booth.height / 2 }
const angled = patchBoothSubTableRotation(booth, 't0', 45)
const afterCenter = {
  x: angled.x + angled.width / 2,
  y: angled.y + angled.height / 2,
}
assert(
  approx(beforeCenter.x, afterCenter.x) && approx(beforeCenter.y, afterCenter.y),
  'pivot stable after sub-table 45°'
)
assert(
  angled.width > 0 && angled.height > 0,
  'compound dimensions positive after sub-table angle'
)
assert(
  angled.tableCluster!.subTables[0]!.rotationOffsetDeg === 45,
  'sub-table rotation stored'
)

const bounds = compoundBoundsFromCluster(angled)
assert(
  approx(bounds.width, angled.width) && approx(bounds.height, angled.height),
  'parent box matches compound bounds'
)

const probes = placementProbesForObject(angled)
assert(probes.length === 2, 'two placement probes')

const neighbor = createBoothWithTableCluster('2x5', {
  x: afterCenter.x,
  y: afterCenter.y,
})
assert(
  placedObjectsOverlap(angled, neighbor),
  'overlap uses per-sub-table probes (cluster booths intersect)'
)

const three = createBoothWithTableCluster('3x6', { x: 10, y: 10 })
assert(three.tableCluster?.subTables.length === 3, '3x6 has three tables')

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
