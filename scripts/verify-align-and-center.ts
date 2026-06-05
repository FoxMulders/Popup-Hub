/**
 * Pure-math verification for the toolbar Center View + selection
 * alignment pipeline.
 *
 * Run with: npx tsx scripts/verify-align-and-center.ts
 *
 * Center View is wired through a viewport API that depends on the DOM,
 * so this script verifies the *upstream* math the host hands to that
 * API:
 *   1. The all-objects bounding box matches `groupRotatedAabb` — the
 *      same union the toolbar handler computes before calling
 *      `viewport.fitToBounds(...)`.
 *   2. `alignSelectionPatches` snaps centers to the median, leaves
 *      already-aligned objects untouched, respects locked objects,
 *      clamps to canvas, and produces the right axis behaviour.
 */

import {
  alignSelectionPatches,
  distributeSelectionPatches,
  groupRotatedAabb,
  median,
  objectCenter,
} from '../components/coordinator/floor-plan-v2/interactions/geometry'
import type { BoothObject, PlacedObject } from '../components/coordinator/floor-plan-v2/state/types'

const CANVAS_W = 100
const CANVAS_L = 100

function makeBooth(over: Partial<BoothObject>): BoothObject {
  return {
    id: 'b',
    kind: 'booth',
    x: 0,
    y: 0,
    width: 8,
    height: 6,
    rotation: 0,
    ...over,
  }
}

let pass = 0
let fail = 0
function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
  }
}

function approxEq(a: number, b: number, eps = 1e-3): boolean {
  return Math.abs(a - b) < eps
}

console.log('CENTER VIEW — group bbox math')

{
  // Three booths spread across the canvas. The all-objects bbox is the
  // union of every rotated AABB; the host frames that with fitToBounds.
  const objects: PlacedObject[] = [
    makeBooth({ id: 'a', x: 5, y: 10, width: 8, height: 6 }),
    makeBooth({ id: 'b', x: 30, y: 12, width: 8, height: 6 }),
    makeBooth({ id: 'c', x: 50, y: 40, width: 8, height: 6 }),
  ]
  const bbox = groupRotatedAabb(objects)
  assert(
    'union bbox spans every object',
    !!bbox &&
      bbox.x === 5 &&
      bbox.y === 10 &&
      bbox.x + bbox.width === 58 &&
      bbox.y + bbox.height === 46,
    bbox ? `${bbox.x},${bbox.y} ${bbox.width}x${bbox.height}` : 'null'
  )
}

{
  // Empty list yields null — host falls back to the room-centre
  // centerView() in that case.
  const bbox = groupRotatedAabb([])
  assert('empty list returns null', bbox === null)
}

{
  // Rotated booth: bbox is the rotated AABB, larger than the underlying
  // rect on the diagonal. 45° on an 8x6 yields side ≈ √(8²+6²)/√2.
  const obj = makeBooth({ id: 'r', x: 10, y: 10, rotation: 45 })
  const bbox = groupRotatedAabb([obj])
  const expectedSpan = (8 + 6) / Math.SQRT2
  assert(
    'rotated booth: bbox enlarges to rotated AABB',
    !!bbox && approxEq(bbox.width, expectedSpan, 0.01) && approxEq(bbox.height, expectedSpan, 0.01),
    bbox ? `${bbox.width.toFixed(3)} × ${bbox.height.toFixed(3)} (expected ${expectedSpan.toFixed(3)})` : 'null'
  )
}

console.log()
console.log('MEDIAN — centre-of-line statistic')

assert('median([]) is null', median([]) === null)
assert('odd count picks middle', median([1, 5, 9]) === 5)
assert('even count averages middle pair', median([1, 3, 5, 9]) === 4)
assert('outlier does not drag median', median([10, 11, 12, 1000]) === 11.5)

console.log()
console.log('ALIGN — vertical (snap centres to median X)')

{
  // Three booths whose X-centres are 9, 14, 50. Median = 14, so the
  // first and last move; the middle booth is already on the line.
  const objects: PlacedObject[] = [
    makeBooth({ id: 'a', x: 5, y: 0, width: 8, height: 6 }),
    makeBooth({ id: 'b', x: 10, y: 10, width: 8, height: 6 }),
    makeBooth({ id: 'c', x: 46, y: 20, width: 8, height: 6 }),
  ]
  const patches = alignSelectionPatches(objects, 'x', CANVAS_W, CANVAS_L)
  assert('two non-aligned objects produce patches', patches.length === 2)
  // Apply patches, then check every centre matches the median.
  const byId = new Map(objects.map((o) => [o.id, o]))
  for (const p of patches) {
    const obj = byId.get(p.id)!
    const next = { ...obj, ...p.patch } as PlacedObject
    byId.set(p.id, next)
  }
  const centresX = Array.from(byId.values()).map((o) => objectCenter(o).x)
  const allMatchMedian = centresX.every((cx) => approxEq(cx, 14))
  assert(
    'every centre lands on median X (=14)',
    allMatchMedian,
    `centres: ${centresX.map((v) => v.toFixed(2)).join(', ')}`
  )
  // Y must be untouched — alignment is single-axis.
  const yUntouched = objects.every((o) => byId.get(o.id)!.y === o.y)
  assert('Y coordinates are untouched (vertical = X-axis only)', yUntouched)
}

console.log()
console.log('ALIGN — horizontal (snap centres to median Y)')

{
  const objects: PlacedObject[] = [
    makeBooth({ id: 'a', x: 0, y: 5, width: 8, height: 6 }),
    makeBooth({ id: 'b', x: 10, y: 14, width: 8, height: 6 }),
    makeBooth({ id: 'c', x: 20, y: 30, width: 8, height: 6 }),
  ]
  // Y-centres: 8, 17, 33; median = 17. Apply.
  const patches = alignSelectionPatches(objects, 'y', CANVAS_W, CANVAS_L)
  const byId = new Map(objects.map((o) => [o.id, o]))
  for (const p of patches) {
    const obj = byId.get(p.id)!
    byId.set(p.id, { ...obj, ...p.patch } as PlacedObject)
  }
  const centresY = Array.from(byId.values()).map((o) => objectCenter(o).y)
  assert(
    'every centre lands on median Y (=17)',
    centresY.every((cy) => approxEq(cy, 17)),
    centresY.map((v) => v.toFixed(2)).join(', ')
  )
  const xUntouched = objects.every((o) => byId.get(o.id)!.x === o.x)
  assert('X coordinates untouched (horizontal = Y-axis only)', xUntouched)
}

console.log()
console.log('ALIGN — locked objects influence the median but never move')

{
  const objects: PlacedObject[] = [
    makeBooth({ id: 'a', x: 0, y: 0, width: 8, height: 6 }),
    makeBooth({ id: 'b', x: 10, y: 0, width: 8, height: 6 }),
    // Locked outlier at the far right — its centre shifts the median
    // but no patch is emitted for its id.
    makeBooth({ id: 'c', x: 80, y: 0, width: 8, height: 6, locked: true }),
  ]
  const patches = alignSelectionPatches(objects, 'x', CANVAS_W, CANVAS_L)
  const lockedHasPatch = patches.some((p) => p.id === 'c')
  assert('locked object has no patch', !lockedHasPatch)
  // X-centres are 4, 14, 84 — median = 14. So 'a' moves to centre at
  // 14 (x = 10), 'b' is already there, 'c' is locked and untouched.
  const a = patches.find((p) => p.id === 'a')
  assert('locked centre still influences median', a !== undefined && approxEq(a.patch.x ?? -1, 10))
}

console.log()
console.log('ALIGN — short-circuits when nothing to do')

{
  // Single object — nothing to align.
  const obj = makeBooth({ id: 's', x: 0, y: 0 })
  const patches = alignSelectionPatches([obj], 'x', CANVAS_W, CANVAS_L)
  assert('single-object selection yields no patches', patches.length === 0)
}

{
  // Already-aligned set — every centre on the median line, no movement.
  const objects: PlacedObject[] = [
    makeBooth({ id: 'a', x: 10, y: 0, width: 8, height: 6 }),
    makeBooth({ id: 'b', x: 10, y: 20, width: 8, height: 6 }),
  ]
  const patches = alignSelectionPatches(objects, 'x', CANVAS_W, CANVAS_L)
  assert('already-aligned selection yields no patches', patches.length === 0)
}

console.log()
console.log('ALIGN — clamps so alignment never pushes off-canvas')

{
  // Tiny canvas — aligning an 8-wide booth to a median of 1 would push
  // it to x = -3 (off-canvas). The clamp pulls it back to x = 0.
  const objects: PlacedObject[] = [
    makeBooth({ id: 'a', x: 50, y: 0, width: 8, height: 6 }),
    makeBooth({ id: 'b', x: -3, y: 0, width: 8, height: 6 }),
    makeBooth({ id: 'c', x: -3, y: 0, width: 8, height: 6 }),
  ]
  // X-centres: 54, 1, 1 → median = 1. Aligning 'a' to centre 1 means
  // x = -3 — clamp pins it to 0.
  const patches = alignSelectionPatches(objects, 'x', CANVAS_W, CANVAS_L)
  const a = patches.find((p) => p.id === 'a')
  assert(
    'off-canvas alignment clamped back to x=0',
    a !== undefined && approxEq(a.patch.x ?? -1, 0)
  )
}

console.log('DISTRIBUTE — equal spacing between endpoints')

{
  const objects: PlacedObject[] = [
    makeBooth({ id: 'a', x: 0, y: 0, width: 8, height: 6 }),
    makeBooth({ id: 'b', x: 20, y: 0, width: 8, height: 6 }),
    makeBooth({ id: 'c', x: 50, y: 0, width: 8, height: 6 }),
  ]
  const patches = distributeSelectionPatches(objects, 'x', CANVAS_W, CANVAS_L)
  const b = patches.find((p) => p.id === 'b')
  assert('middle object moves to evenly spaced center', b !== undefined)
  if (b?.patch.x != null) {
    const centerX = b.patch.x + 4
    assert('middle center lands at 29', approxEq(centerX, 29), String(centerX))
  }
}

{
  const objects: PlacedObject[] = [
    makeBooth({ id: 'a', x: 0, y: 0 }),
    makeBooth({ id: 'b', x: 0, y: 10 }),
  ]
  const patches = distributeSelectionPatches(objects, 'y', CANVAS_W, CANVAS_L)
  assert('fewer than three objects yields no patches', patches.length === 0)
}

console.log()
console.log(`${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
