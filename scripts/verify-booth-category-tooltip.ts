/**
 * Smoke checks for booth category hover tooltip constants and hit-test
 * wiring used by `use-booth-category-tooltip.ts`.
 *
 * Run with: npx tsx scripts/verify-booth-category-tooltip.ts
 */

import { BOOTH_CATEGORY_TOOLTIP_DELAY_MS } from '../components/coordinator/floor-plan-v2/interactions/use-booth-category-tooltip'
import { hitTest } from '../components/coordinator/floor-plan-v2/interactions/geometry'
import type { BoothObject, PlacedObject } from '../components/coordinator/floor-plan-v2/state/types'

function makeBooth(
  id: string,
  x: number,
  y: number,
  categoryName: string | null
): BoothObject {
  return {
    id,
    kind: 'booth',
    x,
    y,
    width: 6,
    height: 5,
    rotation: 0,
    label: '',
    categoryName,
    accentColor: null,
  }
}

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

assert(
  BOOTH_CATEGORY_TOOLTIP_DELAY_MS === 2000,
  `tooltip delay is 2000ms (got ${BOOTH_CATEGORY_TOOLTIP_DELAY_MS})`
)

const objects: PlacedObject[] = [
  makeBooth('a', 10, 10, 'Makeup'),
  makeBooth('b', 20, 10, 'Earrings'),
]

const centerA = hitTest(objects, { x: 13, y: 12.5 })
assert(centerA?.id === 'a', 'hitTest finds topmost booth under pointer')

const centerB = hitTest(objects, { x: 23, y: 12.5 })
assert(centerB?.id === 'b', 'hitTest distinguishes adjacent booths')

const miss = hitTest(objects, { x: 0, y: 0 })
assert(miss === null, 'hitTest returns null off empty grid')

const untagged = makeBooth('c', 30, 10, null)
const tagged = hitTest([...objects, untagged], { x: 33, y: 12.5 })
assert(
  tagged?.kind === 'booth' && !(tagged as BoothObject).categoryName?.trim(),
  'untagged booth is hit-testable but has no category label'
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
