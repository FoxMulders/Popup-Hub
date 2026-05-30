/**
 * Boolean union merge: collinear touch, partial overlap, L-shape, stage bump.
 *
 * Run: npx tsx scripts/verify-merge-adjacent-structures.ts
 */

import {
  mergeAdjacentStructures,
  mergeAdjacentStructuresMany,
  structureFromRect,
} from '../lib/floor-plan/merge-adjacent-structures'
import { buildJoinedZone } from '../components/coordinator/floor-plan-v2/state/room-joins'
import type { PlacedObject, RoomFrame } from '../components/coordinator/floor-plan-v2/state/types'

function expect(label: string, actual: unknown, expected: unknown) {
  const ok =
    typeof actual === 'number' && typeof expected === 'number'
      ? Math.abs(actual - expected) < 0.5
      : JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? '  PASS' : '  FAIL'} - ${label}`)
  if (!ok) {
    console.log(`    expected: ${JSON.stringify(expected)}`)
    console.log(`    actual:   ${JSON.stringify(actual)}`)
    process.exitCode = 1
  }
}

function frame(
  id: string,
  originX: number,
  originY: number,
  widthFt: number,
  lengthFt: number
): RoomFrame {
  return { id, name: id, originX, originY, widthFt, lengthFt }
}

function stage(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
): PlacedObject {
  return { id, kind: 'stage', x, y, width, height, rotation: 0 }
}

console.log('Side-by-side touch — one rectangular union')
{
  const a = structureFromRect('a', 0, 0, 50, 30)
  const b = structureFromRect('b', 50, 0, 30, 30)
  const m = mergeAdjacentStructures(a, b)
  expect('single path', m.paths.length, 1)
  expect('area 2400', m.areaSqFt, 2400)
  expect('bbox width 80', m.aabb.maxX, 80)
}

console.log('Partial overlap — stage into bottom of hall (screenshot case)')
{
  const hall = structureFromRect('hall', 0, 0, 50, 80)
  const annex = structureFromRect('stage', 15, 65, 20, 20)
  const m = mergeAdjacentStructures(hall, annex)
  expect('one outer path', m.paths.length, 1)
  expect('extends below hall', m.aabb.maxY, 85)
  expect('union area = 4000+400-300', m.areaSqFt, 4100)
  const ring = m.paths[0]!
  expect('non-rect union has >4 corners', ring.length > 5, true)
  const zone = buildJoinedZone('g', [frame('hall', 0, 0, 50, 80)], [
    stage('stage', 15, 65, 20, 20),
  ])
  expect('zone area matches', zone?.areaSqFt, 4100)
}

console.log('L-shape — three rooms')
{
  const m = mergeAdjacentStructuresMany([
    structureFromRect('a', 0, 0, 50, 50),
    structureFromRect('b', 50, 0, 50, 50),
    structureFromRect('c', 0, 50, 50, 50),
  ])
  expect('area 7500', m?.areaSqFt, 7500)
  expect('L ring vertices', m?.paths[0]?.length, 7)
}

if (process.exitCode === 1) {
  console.log('\nFAIL')
} else {
  console.log('\nPASS: merge-adjacent-structures')
}
