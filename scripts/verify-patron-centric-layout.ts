/**
 * Patron-centric layout engine verification.
 * Run: npx tsx scripts/verify-patron-centric-layout.ts
 */

import {
  buildPatronPathway,
  calculatePatronCentricLayout,
  PATRON_CORRIDOR_WIDTH_FT,
  PATRON_VISION_CONE_DEG,
} from '../components/coordinator/floor-plan-v2/engine/patron-centric-layout'
import { rotatedAabb } from '../components/coordinator/floor-plan-v2/interactions/geometry'
import { validateClearances } from '../components/coordinator/floor-plan-v2/engine/auto-arrange'
import type { BoothObject } from '../components/coordinator/floor-plan-v2/state/types'

let pass = 0
let fail = 0

function assert(cond: unknown, msg: string) {
  if (cond) {
    console.log(`PASS - ${msg}`)
    pass++
  } else {
    console.log(`FAIL - ${msg}`)
    fail++
  }
}

function booth(i: number, w = 6, h = 2): BoothObject {
  return {
    id: `b-${i}`,
    kind: 'booth',
    x: 0,
    y: 0,
    width: w,
    height: h,
    rotation: 0,
    accentColor: null,
  }
}

const W = 40
const H = 72
const objects = Array.from({ length: 12 }, (_, i) => booth(i))

const layout = calculatePatronCentricLayout(W, H, objects, {
  layoutStyle: 'chevron-45',
})

assert(layout.placed.length >= 6, `places majority of booths (${layout.placed.length}/12)`)
assert(layout.pathway.length >= 4, 'builds winding patron pathway')
assert(
  layout.pathway.every(
    (p) => p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H
  ),
  'pathway stays inside room'
)
assert(
  layout.placed.some((b) => Math.abs(b.rotation) > 1),
  'at least one booth uses non-zero rotation'
)
assert(layout.visualEquityScore > 0.05, `visual equity score ${layout.visualEquityScore.toFixed(2)}`)

const path = buildPatronPathway(
  W,
  H,
  { x: W / 2, y: H - 3.5 },
  { x: W / 2, y: 3.5 },
  PATRON_CORRIDOR_WIDTH_FT,
  2
)
assert(path.length >= 5, 'serpentine path has multiple waypoints')

const doc = {
  canvasWidthFt: W,
  canvasLengthFt: H,
  gridSpacingFt: 1,
  snapFt: 1,
  objects: layout.placed.map((p) => ({ ...p, kind: 'booth' as const })),
}
assert(
  validateClearances(doc).length === 0,
  'placed layout passes rotated clearance validation'
)


console.log(`\nPatron vision cone: ${PATRON_VISION_CONE_DEG}°`)
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
