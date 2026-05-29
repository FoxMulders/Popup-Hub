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
 *   - The same-category proximity rule (`< 5 cols AND < 2 rows`,
 *     center-to-center) is satisfied across every same-category
 *     pair the engine produced.
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
import {
  PROXIMITY_MIN_COLUMNS,
  PROXIMITY_MIN_ROWS,
} from '../components/coordinator/floor-plan-v2/interactions/category-rules'
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

function makeNarrowBooth(
  i: number,
  over: Partial<BoothObject> = {}
): BoothObject {
  return {
    id: `n${i}`,
    kind: 'booth',
    x: 0,
    y: 0,
    width: 4, // Narrow enough that adjacent booths in a row are
    height: 5, // < 5 cols apart center-to-center → triggers proximity
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
  /**
   * If true, the engine MUST report `unsatisfiedCategoryCount > 0`
   * for the case to count as a pass — the fallback path is what's
   * being exercised.
   */
  expectFallback?: boolean
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
  {
    name: 'single-category over-supply triggers fallback (proximity unsatisfiable)',
    doc: makeDoc(
      40,
      72,
      Array.from({ length: 16 }, (_, i) => makeBooth(i))
    ),
    // With only one category, every same-category placement after
    // the first will violate the < 5 cols / < 2 rows rule. The
    // engine should still place every booth (with categoryName=null
    // for the overflow) and report unsatisfiedCategoryCount > 0.
    categories: ['Solo'],
    expectMin: 16,
  },
  {
    name: '24 booths with 6 categories — every same-category pair must clear < 5/< 2',
    doc: makeDoc(
      40,
      72,
      Array.from({ length: 24 }, (_, i) => makeBooth(i))
    ),
    categories: ['Art', 'Food', 'Crafts', 'Music', 'Books', 'Wellness'],
    expectMin: 20,
  },
  {
    name: 'narrow 4ft booths × single category → fallback fires',
    doc: makeDoc(
      40,
      72,
      Array.from({ length: 8 }, (_, i) => makeNarrowBooth(i))
    ),
    // 4-ft booths sit 4 cols apart edge-to-edge → 4 < 5, dy=0 < 2.
    // With one category every booth past the first should fail
    // proximity → engine should drop those to categoryName=null and
    // bump unsatisfiedCategoryCount.
    categories: ['Solo'],
    expectMin: 8,
    expectFallback: true,
  },
  {
    name: 'narrow 4ft booths × 4 categories → fallback NOT needed (rotor finds slots)',
    doc: makeDoc(
      40,
      72,
      Array.from({ length: 16 }, (_, i) => makeNarrowBooth(i))
    ),
    categories: ['Art', 'Food', 'Crafts', 'Music'],
    expectMin: 12,
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

  // Hard proximity rule: every pair of same-category booths in the
  // arranged doc must satisfy `dxColumns >= 5 OR dyRows >= 2`. Any
  // pair that violates is a bug in the engine — we only allow the
  // exception when the engine reported it via unsatisfiedCategoryCount
  // (i.e. it knew the canvas was too tight to fit every category).
  let proximityViolations: Array<{
    a: string
    b: string
    cat: string
    dxCols: number
    dyRows: number
  }> = []
  {
    const booths = result.doc.objects.filter(
      (o): o is BoothObject => o.kind === 'booth'
    )
    const grid = c.doc.gridSpacingFt > 0 ? c.doc.gridSpacingFt : 1
    for (let i = 0; i < booths.length; i++) {
      const a = booths[i]!
      const acat = a.categoryName?.trim().toLowerCase()
      if (!acat) continue
      const acx = a.x + a.width / 2
      const acy = a.y + a.height / 2
      for (let j = i + 1; j < booths.length; j++) {
        const b = booths[j]!
        const bcat = b.categoryName?.trim().toLowerCase()
        if (!bcat || bcat !== acat) continue
        const bcx = b.x + b.width / 2
        const bcy = b.y + b.height / 2
        const dxCols = Math.abs(acx - bcx) / grid
        const dyRows = Math.abs(acy - bcy) / grid
        if (
          dxCols < PROXIMITY_MIN_COLUMNS &&
          dyRows < PROXIMITY_MIN_ROWS
        ) {
          proximityViolations.push({
            a: a.id,
            b: b.id,
            cat: a.categoryName ?? '',
            dxCols,
            dyRows,
          })
        }
      }
    }
  }

  const proximityOk = proximityViolations.length === 0
  const fallbackOk = c.expectFallback
    ? result.unsatisfiedCategoryCount > 0
    : true
  const tag =
    ok && !adjacentDuplicate && proximityOk && fallbackOk ? 'PASS' : 'FAIL'
  console.log(
    `${tag}  in=${before} placed=${placed} dropped=${dropped} ` +
      `expect>=${c.expectMin} adjDup=${adjacentDuplicate} ` +
      `proxViol=${proximityViolations.length} ` +
      `unsat=${result.unsatisfiedCategoryCount} ` +
      `expectFallback=${c.expectFallback ?? false} -- ${c.name}`
  )
  if (errors.length > 0) {
    for (const e of errors.slice(0, 5)) console.log(`      !! ${e}`)
    if (errors.length > 5) console.log(`      ... ${errors.length - 5} more`)
  }
  if (proximityViolations.length > 0) {
    for (const v of proximityViolations.slice(0, 5)) {
      console.log(
        `      !! same-category proximity: ${v.a} <-> ${v.b} cat="${v.cat}" dx=${v.dxCols.toFixed(1)} dy=${v.dyRows.toFixed(1)}`
      )
    }
  }
  if (c.expectFallback && result.unsatisfiedCategoryCount === 0) {
    console.log(`      !! expected unsatisfiedCategoryCount > 0`)
  }
  if (ok && !adjacentDuplicate && proximityOk && fallbackOk) pass++
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
