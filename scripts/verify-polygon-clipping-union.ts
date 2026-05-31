/**
 * Winding-safe union smoke test — npx tsx scripts/verify-polygon-clipping-union.ts
 */

import type { Polygon } from 'polygon-clipping'
import {
  guardedPolygonUnion,
  maxInputPolygonArea,
  multiPolygonOuterArea,
  reverseRing,
} from '../lib/floor-plan/polygon-clipping-union'

function rect(x: number, y: number, w: number, h: number): Polygon {
  return [
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
      [x, y],
    ],
  ]
}

function expect(label: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`)
  if (!ok) process.exitCode = 1
}

console.log('Touching halls union grows area')
{
  const a = rect(0, 0, 50, 30)
  const b = rect(50, 0, 30, 30)
  const mp = guardedPolygonUnion([a, b])
  const out = multiPolygonOuterArea(mp)
  const baseline = maxInputPolygonArea([a, b])
  expect('output >= largest participant', out >= baseline * 0.99)
  expect('output ~= sum of rects', Math.abs(out - 50 * 30 - 30 * 30) < 1)
}

console.log('CW-wound inputs still produce solid union')
{
  const a = rect(0, 0, 40, 25)
  const b = rect(35, 10, 30, 25)
  const cwA: Polygon = [reverseRing(a[0]!)]
  const cwB: Polygon = [reverseRing(b[0]!)]
  const mp = guardedPolygonUnion([cwA, cwB])
  const out = multiPolygonOuterArea(mp)
  expect('union area > 0', out > 40 * 25)
  expect('union not inverted', out >= maxInputPolygonArea([a, b]) * 0.95)
}

if (process.exitCode) {
  console.error('\nPolygon clipping union verification failed.')
  process.exit(1)
}
console.log('\nAll polygon clipping union checks passed.')
