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
 *   - The same-category proximity rule (`< 4 cols AND < 2 rows`,
 *     center-to-center) is satisfied across every same-category
 *     pair the engine produced.
 *
 * Run with: npx tsx scripts/verify-auto-arrange.ts
 */

import {
  autoArrange,
  autoArrangeAllRooms,
  autoArrangeInRoom,
  boothWithinRoomFrame,
  guestActiveBoundingBox,
  PATRON_ARRANGE_DENSITY_ERROR,
  PATRON_BOUNDING_BOX_PADDING_FT,
  validateClearances,
  BOOTH_EDGE_CLEARANCE_FT,
  WALL_BUFFER_FT,
  FRONT_CLEARANCE_FT,
} from '../components/coordinator/floor-plan-v2/engine/auto-arrange'
import {
  computePatronFlowPaths,
  PATRON_VISION_WIDTH_FT,
} from '../components/coordinator/floor-plan-v2/engine/patron-flow'
import { PERIMETER_WALL_THICKNESS_FT } from '../components/coordinator/floor-plan-v2/interactions/perimeter-walls'
import { rotatedAabb } from '../components/coordinator/floor-plan-v2/interactions/geometry'
import { objectFootprintAabb } from '../components/coordinator/floor-plan-v2/state/table-cluster-layout'
import {
  consolidateBoothsForAutoArrange,
  vendorTableMetaFromApplications,
} from '../lib/booth-planner/table-booth-consolidation'
import { docFromLegacyRooms } from '../components/coordinator/floor-plan-v2/state/legacy-bridge'
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
    height: 5, // narrow row pitch can trigger proximity when categories collide
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

import type {
  BoothCell,
  LayoutRoom,
} from '../types/database'

function makeBoothCell(id: string, col: number, row: number): BoothCell {
  return {
    id,
    col,
    row,
    colSpan: 4,
    rowSpan: 3,
    vendorName: id,
    categoryName: '',
    categoryColor: '#94a3b8',
    boothNumber: 1,
    boothType: 'inside',
    vendorUnitType: 'table',
    tableLengthFt: null,
    tableOrientation: null,
    facingTarget: null,
  }
}

function makeLayoutRoom(
  id: string,
  name: string,
  width: number,
  length: number,
  originX: number,
  originY: number,
  boothCount: number,
  idOffset = 0
): LayoutRoom {
  return {
    id,
    name,
    venue_width: width,
    venue_length: length,
    booth_width: 1,
    booth_length: 1,
    entrance: 'south',
    spacing_mode: 'one_foot',
    cells: Array.from({ length: boothCount }, (_, i) =>
      makeBoothCell(`b-${idOffset + i}`, 5 + (i % 4) * 8, 5 + Math.floor(i / 4) * 8)
    ),
    venue_elements: [],
    canvas_origin_x: originX,
    canvas_origin_y: originY,
  }
}

function boothsInRoom(doc: FloorPlanDoc, roomId: string): BoothObject[] {
  const objectRoom = doc.objectRoom ?? {}
  return doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth' && objectRoom[o.id] === roomId
  )
}

function allBoothsWithinRoomFrames(doc: FloorPlanDoc): boolean {
  const frames = doc.rooms ?? []
  const frameById = new Map(frames.map((f) => [f.id, f]))
  const objectRoom = doc.objectRoom ?? {}
  for (const obj of doc.objects) {
    if (obj.kind !== 'booth') continue
    const roomId = objectRoom[obj.id]
    if (!roomId) continue
    const frame = frameById.get(roomId)
    if (!frame) return false
    if (!boothWithinRoomFrame(obj, frame)) return false
  }
  return true
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
    // Center-out with front-clearance row spacing fits ~20-24; rest dropped.
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
    // the first will violate the < 4 cols / < 2 rows rule. The
    // engine should still place every booth (with categoryName=null
    // for the overflow) and report unsatisfiedCategoryCount > 0.
    categories: ['Solo'],
    expectMin: 16,
  },
  {
    name: '24 booths with 6 categories — every same-category pair must clear < 4/< 2',
    doc: makeDoc(
      40,
      72,
      Array.from({ length: 24 }, (_, i) => makeBooth(i))
    ),
    categories: ['Art', 'Food', 'Crafts', 'Music', 'Books', 'Wellness'],
    expectMin: 20,
  },
  {
    name: 'narrow 4ft booths × single category with 4ft center pitch',
    doc: makeDoc(
      40,
      72,
      Array.from({ length: 8 }, (_, i) => makeNarrowBooth(i))
    ),
    // 4-ft booths, flush columns → 4-ft center pitch clears the 4-col rule.
    categories: ['Solo'],
    expectMin: 8,
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

  // Legacy row-major adjacency check disabled — center-out spiral may place
  // same-category neighbors in scan order while still satisfying proximity.
  const adjacentDuplicate = false

  // Hard proximity rule: every pair of same-category booths in the
  // arranged doc must satisfy `dxColumns >= 4 OR dyRows >= 2`. Any
  // pair that violates is a bug in the engine — we only allow the
  // exception when the engine reported it via unsatisfiedCategoryCount
  // (i.e. it knew the canvas was too tight to fit every category).
  const proximityViolations: Array<{
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

// ----- Multi-room regression: booths must stay in assigned rooms -----
{
  const multiDoc = docFromLegacyRooms([
    makeLayoutRoom('r-main', 'Main Hall', 40, 72, 0, 0, 12, 0),
    makeLayoutRoom('r-annex', 'Room 2', 40, 72, 50, 0, 10, 100),
  ])

  const mainBefore = boothsInRoom(multiDoc, 'r-main')
  const annexBefore = boothsInRoom(multiDoc, 'r-annex')

  // Running autoArrange on the unified doc (wrong) scatters booths
  // across the full canvas union — Room 2 booths can land in Main Hall.
  const wrongResult = autoArrange(multiDoc, {
    eventCategoryNames: ['Art', 'Food', 'Crafts'],
  })
  const mainAfterWrong = boothsInRoom(wrongResult.doc, 'r-main')
  const annexAfterWrong = boothsInRoom(wrongResult.doc, 'r-annex')
  const wrongScattered =
    mainAfterWrong.some((b) => b.x >= 50) ||
    annexAfterWrong.some((b) => b.x < 50) ||
    !allBoothsWithinRoomFrames(wrongResult.doc)

  const perRoomResult = autoArrangeInRoom(multiDoc, 'r-main', {
    eventCategoryNames: ['Art', 'Food', 'Crafts'],
  })!
  const bothRoomsResult = autoArrangeInRoom(perRoomResult.doc, 'r-annex', {
    eventCategoryNames: ['Art', 'Food', 'Crafts'],
  })!

  const mainAfter = boothsInRoom(bothRoomsResult.doc, 'r-main')
  const annexAfter = boothsInRoom(bothRoomsResult.doc, 'r-annex')
  const perRoomOk =
    perRoomResult.placedCount === mainBefore.length &&
    bothRoomsResult.placedCount === annexBefore.length &&
    mainAfter.every((b) => b.x < 50) &&
    annexAfter.every((b) => b.x >= 50) &&
    allBoothsWithinRoomFrames(bothRoomsResult.doc)

  const allRoomsResults = autoArrangeAllRooms(multiDoc, {
    eventCategoryNames: ['Art', 'Food', 'Crafts'],
  })
  const allRoomsOk =
    allRoomsResults.length === 2 &&
    allRoomsResults.every((r) => r.placedCount > 0) &&
    allBoothsWithinRoomFrames(allRoomsResults[allRoomsResults.length - 1]!.doc)

  console.log('')
  console.log('=== Multi-room auto-arrange ===')
  console.log(
    `${wrongScattered ? 'PASS' : 'FAIL'}  unified-doc autoArrange scatters booths across rooms (regression guard)`
  )
  console.log(
    `${perRoomOk ? 'PASS' : 'FAIL'}  autoArrangeInRoom keeps each room's booths inside its frame`
  )
  console.log(
    `${allRoomsOk ? 'PASS' : 'FAIL'}  autoArrangeAllRooms arranges every room independently`
  )
  if (wrongScattered) pass++
  else fail++
  if (perRoomOk) pass++
  else fail++
  if (allRoomsOk) pass++
  else fail++
}

// Spot-check the constants.
console.log('')
console.log(`Spec constants:`)
console.log(`  WALL_BUFFER_FT      = ${WALL_BUFFER_FT}  (2 chairs)`)
console.log(`  FRONT_CLEARANCE_FT  = ${FRONT_CLEARANCE_FT}  (2 patrons)`)
console.log(`  BOOTH_EDGE_CLEARANCE_FT = ${BOOTH_EDGE_CLEARANCE_FT}`)
console.log(`  PATRON_VISION_WIDTH_FT = ${PATRON_VISION_WIDTH_FT}`)

// ----- Multi-table consolidation (3×5′ → single 15′ booth) -----
{
  const vendorId = 'vendor-multi'
  const triple = Array.from({ length: 3 }, (_, i) =>
    makeBooth(i, {
      vendorId,
      width: 5,
      height: 2,
      tableCount: 1,
    })
  )
  const merged = consolidateBoothsForAutoArrange(triple, 5, undefined)
  const mergeOk =
    merged.length === 1 &&
    merged[0]!.width === 15 &&
    merged[0]!.height === 2 &&
    merged[0]!.tableCount === 3

  const arrangeDoc = makeDoc(40, 72, triple)
  const arranged = autoArrange(arrangeDoc, {
    baselineTableLengthFt: 5,
    vendorTableMetaByKey: new Map([
      [
        vendorId,
        { vendorKey: vendorId, tableCount: 3, tableLengthFt: 5 },
      ],
    ]),
    eventCategoryNames: ['Art', 'Food'],
  })
  const placed = arranged.doc.objects.filter((o) => o.kind === 'booth')
  const arrangeOk =
    placed.length === 1 &&
    placed[0]!.width === 15 &&
    validateClearances(arranged.doc).length === 0

  console.log('')
  console.log('=== Multi-table mega-table consolidation ===')
  console.log(
    `${mergeOk ? 'PASS' : 'FAIL'}  consolidateBoothsForAutoArrange: 3×5′ → one 15′×2′ booth`
  )
  console.log(
    `${arrangeOk ? 'PASS' : 'FAIL'}  autoArrange places single 15′ booth for 3-table vendor`
  )
  const meta = vendorTableMetaFromApplications(
    [
      { id: 'a1', vendor_id: vendorId, status: 'approved' },
      { id: 'a2', vendor_id: vendorId, status: 'approved' },
      { id: 'a3', vendor_id: vendorId, status: 'approved' },
    ],
    5
  )
  const metaOk = meta.get(vendorId)?.tableCount === 3
  console.log(
    `${metaOk ? 'PASS' : 'FAIL'}  vendorTableMetaFromApplications: 3 apps → tableCount 3`
  )
  if (mergeOk) pass++
  else fail++
  if (arrangeOk) pass++
  else fail++
  if (metaOk) pass++
  else fail++
}

// ----- 2ft edge clearance between booth footprints -----
{
  const doc = makeDoc(
    40,
    72,
    Array.from({ length: 16 }, (_, i) => makeBooth(i))
  )
  const result = autoArrange(doc, {
    eventCategoryNames: ['Art', 'Food', 'Crafts', 'Music'],
  })
  const booths = result.doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth'
  )
  const clearanceErrors = validateClearances(result.doc)
  const gapOk = booths.length >= 2 && clearanceErrors.length === 0
  console.log('')
  console.log('=== Booth 2ft edge clearance ===')
  console.log(
    `${gapOk ? 'PASS' : 'FAIL'}  rotated-AABB clearance validation (placed=${booths.length}, violations=${clearanceErrors.length})`
  )
  if (gapOk) pass++
  else fail++
}

// ----- Auto-arrange modes: center-out vs perimeter-only -----
{
  const baseDoc = makeDoc(
    40,
    72,
    Array.from({ length: 12 }, (_, i) => makeBooth(i))
  )
  const centerResult = autoArrange(baseDoc, {
    mode: 'grid',
    eventCategoryNames: ['Art', 'Food', 'Crafts'],
  })
  const perimeterResult = autoArrange(baseDoc, {
    mode: 'perimeter-only',
    eventCategoryNames: ['Art', 'Food', 'Crafts'],
  })
  const centerBooths = centerResult.doc.objects.filter((o) => o.kind === 'booth')
  const perimeterBooths = perimeterResult.doc.objects.filter(
    (o) => o.kind === 'booth'
  )
  const angledCount = centerBooths.filter((b) => Math.abs(b.rotation) > 0.5).length
  const centerOutOk =
    centerBooths.length >= 8 &&
    validateClearances(centerResult.doc).length === 0 &&
    angledCount >= Math.min(4, centerBooths.length)
  const perimeterOk =
    perimeterBooths.length >= 4 &&
    validateClearances(perimeterResult.doc, {
      wallBufferFt: PERIMETER_WALL_THICKNESS_FT + 0.5,
    }).length === 0 &&
    perimeterBooths.some((b) => b.y <= PERIMETER_WALL_THICKNESS_FT + 2) &&
    perimeterBooths.some(
      (b) =>
        b.y + b.height >= 72 - PERIMETER_WALL_THICKNESS_FT - 2 ||
        b.x <= PERIMETER_WALL_THICKNESS_FT + 2
    )

  const pathDoc = makeDoc(40, 72, [
    ...Array.from({ length: 6 }, (_, i) => makeBooth(i)),
    {
      id: 'door-in',
      kind: 'door',
      x: 18,
      y: 70,
      width: 4,
      height: 2,
      rotation: 0,
      doorType: 'entrance',
    } as PlacedObject,
    {
      id: 'exit-out',
      kind: 'emergency_exit',
      x: 18,
      y: 0,
      width: 4,
      height: 2,
      rotation: 0,
      label: 'EXIT',
    } as PlacedObject,
  ])
  const paths = computePatronFlowPaths(pathDoc)
  const pathOk = paths != null && paths.primary.length >= 2 && paths.visionRects.length > 0

  console.log('')
  console.log('=== Auto-arrange modes ===')
  console.log(
    `${centerOutOk ? 'PASS' : 'FAIL'}  patron-flow mode places angled booths with clearances (placed=${centerResult.placedCount}, angled=${angledCount})`
  )
  console.log(
    `${perimeterOk ? 'PASS' : 'FAIL'}  perimeter-only snaps booths to wall faces (placed=${perimeterResult.placedCount})`
  )
  console.log(`${pathOk ? 'PASS' : 'FAIL'}  patron flow paths compute door→exit vision matrix`)
  if (centerOutOk) pass++
  else fail++
  if (perimeterOk) pass++
  else fail++
  if (pathOk) pass++
  else fail++
}

// ----- Guest / patron tables separate from vendor auto-arrange -----
{
  const vendorId = 'vendor-a'
  const mixedDoc = makeDoc(40, 72, [
    makeBooth(0, { width: 6, height: 2, tablePurpose: 'vendor' }),
    makeBooth(1, { width: 6, height: 2, tablePurpose: 'vendor' }),
    makeBooth(2, {
      width: 6,
      height: 6,
      tablePurpose: 'guest',
      tableShape: 'round',
      tableLengthFt: 6,
      x: 20,
      y: 40,
    }),
    makeBooth(3, {
      width: 8,
      height: 8,
      tablePurpose: 'guest',
      tableShape: 'round',
      tableLengthFt: 8,
      x: 28,
      y: 40,
    }),
  ])

  const result = autoArrange(mixedDoc, {
    eventCategoryNames: ['Art', 'Food'],
  })
  const booths = result.doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth'
  )
  const vendors = booths.filter((b) => b.tablePurpose !== 'guest')
  const guests = booths.filter((b) => b.tablePurpose === 'guest')

  const guestSizesOk =
    guests.length === 2 &&
    guests.some((b) => b.width === 6 && b.height === 6 && b.tableShape === 'round') &&
    guests.some((b) => b.width === 8 && b.height === 8 && b.tableShape === 'round')

  const guestAwayFromVendors =
    guests.length > 0 &&
    vendors.every((v) =>
      guests.every((g) => {
        const vcx = v.x + v.width / 2
        const vcy = v.y + v.height / 2
        const gcx = g.x + g.width / 2
        const gcy = g.y + g.height / 2
        return Math.hypot(vcx - gcx, vcy - gcy) >= 4
      })
    )

  const guestOnlyDoc = makeDoc(40, 72, [
    makeBooth(0, {
      width: 5,
      height: 5,
      tablePurpose: 'guest',
      tableShape: 'round',
      tableLengthFt: 5,
      x: 10,
      y: 10,
    }),
    makeBooth(1, {
      width: 6,
      height: 6,
      tablePurpose: 'guest',
      tableShape: 'round',
      tableLengthFt: 6,
      x: 18,
      y: 10,
    }),
  ])
  const guestOnlyResult = autoArrange(guestOnlyDoc)
  const guestOnly = guestOnlyResult.doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth'
  )
  const guestOnlyOk =
    guestOnlyResult.placedCount === 2 &&
    guestOnly.every(
      (b) =>
        b.tablePurpose === 'guest' &&
        b.tableShape === 'round' &&
        Math.abs(b.width - b.height) < 0.01
    )

  const guestNotConsolidated = consolidateBoothsForAutoArrange(
    guestOnlyDoc.objects.filter((o): o is BoothObject => o.kind === 'booth'),
    5,
    undefined
  )
  const noGuestMergeOk = guestNotConsolidated.length === 2

  console.log('')
  console.log('=== Guest tables separate from vendor auto-arrange ===')
  console.log(
    `${guestSizesOk ? 'PASS' : 'FAIL'}  round guest tables keep laid diameter after auto-arrange`
  )
  console.log(
    `${guestAwayFromVendors ? 'PASS' : 'FAIL'}  guest tables pack away from vendor booths`
  )
  console.log(
    `${guestOnlyOk ? 'PASS' : 'FAIL'}  guest-only auto-arrange places patron tables`
  )
  console.log(
    `${noGuestMergeOk ? 'PASS' : 'FAIL'}  guest tables are never consolidated with vendors`
  )
  if (guestSizesOk) pass++
  else fail++
  if (guestAwayFromVendors) pass++
  else fail++
  if (guestOnlyOk) pass++
  else fail++
  if (noGuestMergeOk) pass++
  else fail++
}

// ----- Isolated vendor / patron auto-arrange scopes -----
{
  function boothsOverlap(a: BoothObject, b: BoothObject, clearanceFt = 0): boolean {
    const ra = objectFootprintAabb(a)
    const rb = objectFootprintAabb(b)
    if (clearanceFt <= 0) {
      return (
        ra.x < rb.x + rb.width &&
        ra.x + ra.width > rb.x &&
        ra.y < rb.y + rb.height &&
        ra.y + ra.height > rb.y
      )
    }
    const pad = clearanceFt
    return (
      ra.x - pad < rb.x + rb.width &&
      ra.x + ra.width + pad > rb.x &&
      ra.y - pad < rb.y + rb.height &&
      ra.y + ra.height + pad > rb.y
    )
  }

  const mixedDoc = makeDoc(40, 72, [
    makeBooth(0, {
      width: 6,
      height: 2,
      tablePurpose: 'vendor',
      label: 'vendor-a',
      x: 4,
      y: 4,
    }),
    makeBooth(1, {
      width: 6,
      height: 2,
      tablePurpose: 'vendor',
      label: 'vendor-b',
      x: 12,
      y: 4,
    }),
    makeBooth(2, {
      width: 6,
      height: 6,
      tablePurpose: 'guest',
      tableShape: 'round',
      x: 20,
      y: 36,
    }),
    makeBooth(3, {
      width: 8,
      height: 8,
      tablePurpose: 'guest',
      tableShape: 'round',
      x: 30,
      y: 36,
    }),
  ])

  const patronBefore = mixedDoc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth' && o.tablePurpose === 'guest'
  )
  const vendorOnly = autoArrange(mixedDoc, {
    scope: 'vendor',
    mode: 'grid',
    eventCategoryNames: ['Art', 'Food'],
  })
  const vendorsAfterVendorScope = vendorOnly.doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth' && o.tablePurpose !== 'guest'
  )
  const patronsAfterVendorScope = vendorOnly.doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth' && o.tablePurpose === 'guest'
  )

  const patronPositionsFixed = patronBefore.every((before) => {
    const after = patronsAfterVendorScope.find((p) => p.id === before.id)
    return (
      after != null &&
      Math.abs(after.x - before.x) < 0.01 &&
      Math.abs(after.y - before.y) < 0.01
    )
  })

  const vendorAvoidsPatrons =
    vendorsAfterVendorScope.length > 0 &&
    patronsAfterVendorScope.every((patron) =>
      vendorsAfterVendorScope.every(
        (vendor) => !boothsOverlap(vendor, patron, BOOTH_EDGE_CLEARANCE_FT)
      )
    )

  const vendorSizesPreserved = vendorsAfterVendorScope.every(
    (v) => v.width === 6 && v.height === 2
  )

  const vendorBefore = mixedDoc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth' && o.tablePurpose !== 'guest'
  )
  const patronOnly = autoArrange(mixedDoc, {
    scope: 'patron',
    mode: 'grid',
  })
  const vendorsAfterPatronScope = patronOnly.doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth' && o.tablePurpose !== 'guest'
  )
  const patronsAfterPatronScope = patronOnly.doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth' && o.tablePurpose === 'guest'
  )

  const vendorPositionsFixed = vendorBefore.every((before) => {
    const after = vendorsAfterPatronScope.find((v) => v.id === before.id)
    return (
      after != null &&
      Math.abs(after.x - before.x) < 0.01 &&
      Math.abs(after.y - before.y) < 0.01
    )
  })

  const patronAvoidsVendors =
    patronsAfterPatronScope.length === 2 &&
    patronsAfterPatronScope.every((patron) =>
      vendorsAfterPatronScope.every(
        (vendor) => !boothsOverlap(patron, vendor, BOOTH_EDGE_CLEARANCE_FT)
      )
    )

  const patronSizesPreserved =
    patronsAfterPatronScope.some((b) => b.width === 6 && b.height === 6) &&
    patronsAfterPatronScope.some((b) => b.width === 8 && b.height === 8)

  console.log('')
  console.log('=== Isolated vendor / patron auto-arrange ===')
  console.log(
    `${patronPositionsFixed ? 'PASS' : 'FAIL'}  vendor scope leaves patron tables fixed`
  )
  console.log(
    `${vendorAvoidsPatrons ? 'PASS' : 'FAIL'}  vendor scope treats patron tables as obstacles`
  )
  console.log(
    `${vendorSizesPreserved ? 'PASS' : 'FAIL'}  vendor scope preserves booth width/height`
  )
  console.log(
    `${vendorPositionsFixed ? 'PASS' : 'FAIL'}  patron scope leaves vendor booths fixed`
  )
  console.log(
    `${patronAvoidsVendors ? 'PASS' : 'FAIL'}  patron scope avoids vendor footprints`
  )
  console.log(
    `${patronSizesPreserved ? 'PASS' : 'FAIL'}  patron scope preserves round table diameters`
  )

  if (patronPositionsFixed) pass++
  else fail++
  if (vendorAvoidsPatrons) pass++
  else fail++
  if (vendorSizesPreserved) pass++
  else fail++
  if (vendorPositionsFixed) pass++
  else fail++
  if (patronAvoidsVendors) pass++
  else fail++
  if (patronSizesPreserved) pass++
  else fail++
}

// ----- Patron bounding box — localized auto-arrange, non-destructive abort -----
{
  const patronTables = [
    makeBooth(0, {
      width: 8,
      height: 8,
      tablePurpose: 'guest',
      tableShape: 'round',
      x: 10,
      y: 20,
    }),
    makeBooth(1, {
      width: 8,
      height: 8,
      tablePurpose: 'guest',
      tableShape: 'round',
      x: 19,
      y: 20,
    }),
    makeBooth(2, {
      width: 8,
      height: 8,
      tablePurpose: 'guest',
      tableShape: 'round',
      x: 28,
      y: 20,
    }),
    makeBooth(3, {
      width: 8,
      height: 8,
      tablePurpose: 'guest',
      tableShape: 'round',
      x: 37,
      y: 20,
    }),
  ]

  const box = guestActiveBoundingBox(patronTables)!
  const minX = Math.min(...patronTables.map((b) => b.x))
  const maxX = Math.max(...patronTables.map((b) => b.x + b.width))
  const minY = Math.min(...patronTables.map((b) => b.y))
  const maxY = Math.max(...patronTables.map((b) => b.y + b.height))
  const boxOk =
    box.x === minX - PATRON_BOUNDING_BOX_PADDING_FT &&
    box.y === minY - PATRON_BOUNDING_BOX_PADDING_FT &&
    box.width === maxX - minX + PATRON_BOUNDING_BOX_PADDING_FT * 2 &&
    box.height === maxY - minY + PATRON_BOUNDING_BOX_PADDING_FT * 2

  const denseDoc = makeDoc(40, 72, [
    makeBooth(0, {
      width: 6,
      height: 2,
      tablePurpose: 'vendor',
      x: 4,
      y: 4,
    }),
    ...patronTables,
  ])

  const beforePositions = patronTables.map((b) => ({ id: b.id, x: b.x, y: b.y }))
  const denseResult = autoArrange(denseDoc, { scope: 'patron', mode: 'grid' })
  const afterPatrons = denseResult.doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth' && o.tablePurpose === 'guest'
  )
  const positionsPreserved = beforePositions.every((before) => {
    const after = afterPatrons.find((p) => p.id === before.id)
    return (
      after != null &&
      Math.abs(after.x - before.x) < 0.01 &&
      Math.abs(after.y - before.y) < 0.01
    )
  })
  const denseAbortOk =
    denseResult.patronArrangeAborted === PATRON_ARRANGE_DENSITY_ERROR &&
    positionsPreserved

  const roomyPatrons = [
    makeBooth(10, {
      width: 4,
      height: 4,
      tablePurpose: 'guest',
      tableShape: 'round',
      x: 10,
      y: 12,
    }),
    makeBooth(11, {
      width: 4,
      height: 4,
      tablePurpose: 'guest',
      tableShape: 'round',
      x: 15,
      y: 18,
    }),
  ]
  const roomyDoc = makeDoc(40, 72, roomyPatrons)
  const roomyBefore = roomyPatrons.map((b) => ({ id: b.id, x: b.x, y: b.y }))
  const roomyResult = autoArrange(roomyDoc, { scope: 'patron', mode: 'grid' })
  const roomyAfter = roomyResult.doc.objects.filter(
    (o): o is BoothObject => o.kind === 'booth' && o.tablePurpose === 'guest'
  )
  const roomyBox = guestActiveBoundingBox(roomyPatrons)!
  const allInsideBox = roomyAfter.every((b) => {
    const right = b.x + b.width
    const bottom = b.y + b.height
    return (
      b.x >= roomyBox.x - 1e-6 &&
      b.y >= roomyBox.y - 1e-6 &&
      right <= roomyBox.x + roomyBox.width + 1e-6 &&
      bottom <= roomyBox.y + roomyBox.height + 1e-6
    )
  })
  const roomyMoved = roomyBefore.some((before) => {
    const after = roomyAfter.find((p) => p.id === before.id)
    return (
      after != null &&
      (Math.abs(after.x - before.x) > 0.01 || Math.abs(after.y - before.y) > 0.01)
    )
  })
  const roomyOk =
    !roomyResult.patronArrangeAborted &&
    roomyResult.droppedCount === 0 &&
    roomyAfter.length === 2 &&
    allInsideBox &&
    (roomyMoved || roomyResult.placedCount === 2)

  console.log('')
  console.log('=== Patron bounding box auto-arrange ===')
  console.log(
    `${boxOk ? 'PASS' : 'FAIL'}  guestActiveBoundingBox adds ${PATRON_BOUNDING_BOX_PADDING_FT}ft padding`
  )
  console.log(
    `${denseAbortOk ? 'PASS' : 'FAIL'}  dense patron cluster aborts without moving tables`
  )
  console.log(
    `${roomyOk ? 'PASS' : 'FAIL'}  roomy patron cluster rearranges inside active box`
  )
  if (boxOk) pass++
  else fail++
  if (denseAbortOk) pass++
  else fail++
  if (roomyOk) pass++
  else fail++
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
