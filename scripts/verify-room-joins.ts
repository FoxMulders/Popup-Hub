/**
 * Smoke-test the polygon-join geometry: build a few overlapping /
 * touching / detached frame configurations and assert the
 * union / overlap / touch / joinable-groups output.
 *
 * Run with: npx tsx scripts/verify-room-joins.ts
 */

import {
  buildJoinedZone,
  framesOverlap,
  framesOverlapOrTouch,
  framesTouch,
  frameOverlapsUnion,
  joinableGroups,
  neighborsOf,
} from '../components/coordinator/floor-plan-v2/state/room-joins'
import type { RoomFrame } from '../components/coordinator/floor-plan-v2/state/types'

function frame(
  id: string,
  originX: number,
  originY: number,
  widthFt: number,
  lengthFt: number
): RoomFrame {
  return { id, name: id, originX, originY, widthFt, lengthFt }
}

function expect(label: string, actual: unknown, expected: unknown) {
  const ok =
    typeof actual === 'object'
      ? JSON.stringify(actual) === JSON.stringify(expected)
      : actual === expected
  console.log(`${ok ? '  PASS' : '  FAIL'} - ${label}`)
  if (!ok) {
    console.log(`    expected: ${JSON.stringify(expected)}`)
    console.log(`    actual:   ${JSON.stringify(actual)}`)
    process.exitCode = 1
  }
}

console.log('Scenario 1: two touching rooms (shared edge, no overlap)')
{
  const a = frame('a', 0, 0, 50, 30)
  const b = frame('b', 50, 0, 30, 30)
  expect('touch', framesTouch(a, b), true)
  expect('overlap', framesOverlap(a, b), false)
  expect('overlapOrTouch', framesOverlapOrTouch(a, b), true)
  const groups = joinableGroups([a, b])
  expect('joinable groups count', groups.length, 1)
  expect('joinable group members', groups[0]?.sort(), ['a', 'b'])
  const zone = buildJoinedZone('g1', [a, b])
  expect('zone built', zone !== null, true)
  expect('zone area', zone?.areaSqFt, 50 * 30 + 30 * 30)
  expect('zone bbox minX', zone?.aabb.minX, 0)
  expect('zone bbox maxX', zone?.aabb.maxX, 80)
}

console.log('Scenario 2: two detached rooms (no contact)')
{
  const a = frame('a', 0, 0, 50, 30)
  const b = frame('b', 60, 0, 30, 30)
  expect('touch', framesTouch(a, b), false)
  expect('overlap', framesOverlap(a, b), false)
  expect('overlapOrTouch', framesOverlapOrTouch(a, b), false)
  const groups = joinableGroups([a, b])
  expect('joinable groups count', groups.length, 0)
}

console.log('Scenario 3: B fully overlaps A (B nested inside A)')
{
  const a = frame('a', 0, 0, 100, 50)
  const b = frame('b', 20, 10, 30, 20)
  expect('overlap', framesOverlap(a, b), true)
  const groups = joinableGroups([a, b])
  expect('joinable groups count', groups.length, 1)
  const zone = buildJoinedZone('g', [a, b])
  // The union of nested rectangles is just A.
  expect('zone area', zone?.areaSqFt, 100 * 50)
}

console.log('Scenario 4: L-shape (3 touching rooms forming L)')
{
  const a = frame('a', 0, 0, 50, 50)
  const b = frame('b', 50, 0, 50, 50)
  const c = frame('c', 0, 50, 50, 50)
  const groups = joinableGroups([a, b, c])
  expect('joinable groups count', groups.length, 1)
  expect('joinable group size', groups[0]?.length, 3)
  const zone = buildJoinedZone('g', [a, b, c])
  expect('zone area', zone?.areaSqFt, 50 * 50 * 3)
  // L-shape outer ring after collinear-vertex dedup by polygon-clipping:
  // (0,0) -> (100,0) -> (100,50) -> (50,50) -> (50,100) -> (0,100) -> (0,0)
  // = 6 distinct corners + closing repeat = 7 vertices.
  expect('zone outer ring length', zone?.rings[0]?.length, 7)
}

console.log('Scenario 5: two touching with a third detached')
{
  const a = frame('a', 0, 0, 30, 30)
  const b = frame('b', 30, 0, 30, 30)
  const c = frame('c', 100, 100, 30, 30)
  const groups = joinableGroups([a, b, c])
  expect('joinable groups count', groups.length, 1)
  expect('joinable group size', groups[0]?.length, 2)
  expect('neighbors of a', neighborsOf([a, b, c], 'a').sort(), ['b'])
}

console.log('Scenario 6: frameOverlapsUnion (target overlaps existing union)')
{
  const a = frame('a', 0, 0, 50, 50)
  const b = frame('b', 30, 30, 50, 50)
  expect('overlaps a', frameOverlapsUnion(b, [a]), true)
  const c = frame('c', 200, 200, 10, 10)
  expect('does not overlap a', frameOverlapsUnion(c, [a]), false)
}

console.log('Scenario 7: epsilon-touch tolerance (≤ 0.25 ft gap counts as touch)')
{
  const a = frame('a', 0, 0, 30, 30)
  const b = frame('b', 30.2, 0, 30, 30) // 0.2 ft gap < default 0.25 eps
  expect('touch with 0.2 ft gap', framesTouch(a, b), true)
  const c = frame('c', 30.5, 0, 30, 30) // 0.5 ft gap > eps
  expect('no touch with 0.5 ft gap', framesTouch(a, c), false)
}

if (process.exitCode === 1) {
  console.log('\nFAIL: at least one assertion failed.')
} else {
  console.log('\nPASS: all room-join scenarios verified.')
}
