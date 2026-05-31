/**
 * Placement ring winding — npx tsx scripts/verify-placement-ring-orientation.ts
 */

import { buildJoinedZone } from '../components/coordinator/floor-plan-v2/state/room-joins'
import type { RoomFrame } from '../components/coordinator/floor-plan-v2/state/types'
import {
  ensurePlacementOuterRing,
  pointInsideOuterRing,
} from '../lib/floor-plan/placement-ring-orientation'

function frame(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): RoomFrame {
  return { id, name: id, originX: x, originY: y, widthFt: w, lengthFt: h }
}

function expect(label: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`)
  if (!ok) process.exitCode = 1
}

console.log('Hall + overlapping stage — interior probe inside union')
{
  const hall = frame('hall', 0, 0, 50, 40)
  const stage = {
    id: 'stage',
    kind: 'stage' as const,
    x: 10,
    y: 30,
    width: 30,
    height: 15,
    rotation: 0,
  }
  const zone = buildJoinedZone('g', [hall], [stage])
  const ring = zone?.rings[0]
  expect('zone built', ring != null)
  const probe = { x: 25, y: 20 }
  expect('hall center inside ring', ring != null && pointInsideOuterRing(probe, ring))
}

console.log('Inverted ring flips when anchor is outside forward winding')
{
  const square = [
    [0, 0],
    [0, 10],
    [10, 10],
    [10, 0],
    [0, 0],
  ] as Array<[number, number]>
  const fixed = ensurePlacementOuterRing(square, { x: 5, y: 5 })
  expect('re-oriented square contains center', pointInsideOuterRing({ x: 5, y: 5 }, fixed))
}

if (process.exitCode) {
  console.error('\nPlacement ring orientation verification failed.')
  process.exit(1)
}
console.log('\nAll placement ring orientation checks passed.')
