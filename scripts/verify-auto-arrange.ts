/**
 * Pure-math verification for the Auto-Arrange engine v1.
 *
 * Builds synthetic FloorPlanDocs with booths, walls, doors, and
 * emergency exits, runs `autoArrange`, then checks that:
 *   - Every placed booth honors the wall / front / back-to-back
 *     clearances from the spec.
 *   - No placed booth overlaps an obstacle or another booth.
 *   - Categories rotate so adjacent slots never share one when more
 *     than one category is defined.
 *
 * Run with: npx tsx scripts/verify-auto-arrange.ts
 */

import {
  autoArrange,
  validateClearances,
  WALL_BUFFER_FT,
  BACK_TO_BACK_GAP_FT,
  FRONT_CLEARANCE_FT,
} from '../components/coordinator/floor-plan-v2/engine/auto-arrange'
import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
} from '../components/coordinator/floor-plan-v2/state/types'

function makeBooth(
  i: number,
  over: Partial<BoothObject> = {}
): BoothObject {
  return {
    id: `b${i}`,
    kind: 'booth',
    x: 0,
    y: 0,
    width: 6,
    height: 5,
    rotation: 0,
    label: '',
    accentColor: null,
    categoryName: null,
    ...over,
  } as BoothObject
}

function makeDoc(
  width: number,
  length: number,
  objects: PlacedObject[]
): FloorPlanDoc {
  return {
    canvasWidthFt: width,
    canvasLengthFt: length,
    gridSpacingFt: 1,
    snapFt: 1,
    objects,
  }
}

interface Case {
  name: string
  doc: FloorPlanDoc
  categories?: string[]
  expectMin: number
}

const cases: Case[] = [
  {
    name: '20 booths in a 40×72 canvas, no obstacles',
    doc: makeDoc(
      40,
      72,
      Array.from({ length: 20 }, (_, i) => makeBooth(i))
    ),
    categories: ['Art', 'Food', 'Crafts', 'Music'],
    expectMin: 20,
  },
  {
    name: '50 booths in a 40×72 canvas (over-supply)',
    doc: makeDoc(
      40,
      72,
      Array.from({ length: 50 }, (_, i) => makeBooth(i))
    ),
    categories: ['Art', 'Food', 'Crafts'],
    // The canvas can fit ~20-24 booths with v1 spacing; the rest
    // should be dropped, not placed out-of-bounds.
    expectMin: 12,
  },
  {
    name: '15 booths with a wall obstacle in the middle',
    doc: makeDoc(40, 72, [
      ...Array.from({ length: 15 }, (_, i) => makeBooth(i)),
      {
        id: 'w1',
        kind: 'wall',
        x: 18,
        y: 30,
        width: 4,
        height: 12,
        rotation: 0,
      } as PlacedObject,
    ]),
    categories: ['Art', 'Food'],
    expectMin: 8,
  },
  {
    name: '6 booths in a tiny 16×24 canvas',
    doc: makeDoc(
      16,
      24,
      Array.from({ length: 6 }, (_, i) => makeBooth(i))
    ),
    categories: ['Art'],
    expectMin: 2,
  },
]

let pass = 0
let fail = 0
for (const c of cases) {
  const before = c.doc.objects.filter((o) => o.kind === 'booth').length
  const result = autoArrange(c.doc, { eventCategoryNames: c.categories })
  const errors = validateClearances(result.doc)
  const placed = result.placedCount
  const dropped = result.droppedCount
  const ok = errors.length === 0 && placed >= c.expectMin

  // Check the category-diversification rule pairwise across rows.
  let adjacentDuplicate = false
  if (c.categories && c.categories.length > 1) {
    const placedBooths = result.doc.objects.filter(
      (o): o is BoothObject => o.kind === 'booth'
    )
    // Sort row-major then x to walk in placement order.
    const sorted = [...placedBooths].sort((a, b) =>
      a.y === b.y ? a.x - b.x : a.y - b.y
    )
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.categoryName === sorted[i - 1]!.categoryName) {
        adjacentDuplicate = true
        break
      }
    }
  }

  const tag = ok && !adjacentDuplicate ? 'PASS' : 'FAIL'
  console.log(
    `${tag}  in=${before} placed=${placed} dropped=${dropped} ` +
      `expect>=${c.expectMin} adjDup=${adjacentDuplicate} -- ${c.name}`
  )
  if (errors.length > 0) {
    for (const e of errors.slice(0, 5)) console.log(`      !! ${e}`)
    if (errors.length > 5) console.log(`      ... ${errors.length - 5} more`)
  }
  if (ok && !adjacentDuplicate) pass++
  else fail++
}

// Spot-check the constants.
console.log('')
console.log(`Spec constants:`)
console.log(`  WALL_BUFFER_FT      = ${WALL_BUFFER_FT}  (2 chairs)`)
console.log(`  FRONT_CLEARANCE_FT  = ${FRONT_CLEARANCE_FT}  (2 patrons)`)
console.log(`  BACK_TO_BACK_GAP_FT = ${BACK_TO_BACK_GAP_FT}  (3 chairs)`)
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
