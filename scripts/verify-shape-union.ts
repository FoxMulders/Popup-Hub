/**
 * Boolean merge smoke test — run: npx tsx scripts/verify-shape-union.ts
 */

import { unionPlacedObjectFootprints } from '../lib/floor-plan/shape-union'
import type { PlacedObject } from '../components/coordinator/floor-plan-v2/state/types'

function wall(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation = 0
): PlacedObject {
  return {
    id,
    kind: 'wall',
    x,
    y,
    width: w,
    height: h,
    rotation,
  }
}

function expect(label: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`)
  if (!ok) process.exitCode = 1
}

console.log('L-shaped union (overlapping rects)')
{
  const a = wall('a', 0, 0, 40, 30)
  const b = wall('b', 10, 20, 30, 30)
  const u = unionPlacedObjectFootprints([a, b])
  expect('union exists', u != null)
  expect('one outer ring', (u?.rings.length ?? 0) >= 1)
  expect('area > single rect', (u?.areaSqFt ?? 0) > 40 * 30)
  expect('aabb spans both', u?.aabb.maxX === 40 && u?.aabb.maxY === 50)
}

console.log('Rotated union')
{
  const a = wall('a', 0, 0, 20, 10, 45)
  const b = wall('b', 8, 4, 20, 10, 45)
  const u = unionPlacedObjectFootprints([a, b])
  expect('rotated union', u != null && (u?.areaSqFt ?? 0) > 0)
}

if (process.exitCode) {
  console.error('\nShape union verification failed.')
  process.exit(1)
}
console.log('\nAll shape union checks passed.')
