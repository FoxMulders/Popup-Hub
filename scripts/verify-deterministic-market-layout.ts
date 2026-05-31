/**
 * Deterministic market layout verification.
 * Run: npx tsx scripts/verify-deterministic-market-layout.ts
 */

import {
  computeMarketLayout,
  maxPerimeterTableCapacity,
  placementsToJson,
} from '../lib/floor-plan/deterministic-market-layout'

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

const W = 60
const H = 80
const TW = 6
const TH = 2.5

const gridA = computeMarketLayout({
  marketDimensions: { width: W, height: H },
  tableDimensions: { width: TW, height: TH },
  totalTables: 8,
  layoutMode: 'grid',
  constraints: [
    {
      type: 'entrance',
      bounds: [{ x: W / 2, y: 0 }],
    },
  ],
})

const gridB = computeMarketLayout({
  marketDimensions: { width: W, height: H },
  tableDimensions: { width: TW, height: TH },
  totalTables: 8,
  layoutMode: 'grid',
  constraints: [
    {
      type: 'entrance',
      bounds: [{ x: W / 2, y: 0 }],
    },
  ],
})

assert(gridA.ok && gridB.ok, 'grid layout succeeds')
if (gridA.ok && gridB.ok) {
  assert(
    JSON.stringify(placementsToJson(gridA.placements)) ===
      JSON.stringify(placementsToJson(gridB.placements)),
    'grid layout is deterministic'
  )
  assert(
    gridA.jsonPlacements.every((p) => p.rotation === 0),
    'grid uses 0° rotation only'
  )
  assert(
    gridA.jsonPlacements.every((p) => p.row >= 1 && p.column >= 1),
    'grid uses 1-based row/column indices'
  )
  const row1 = gridA.jsonPlacements.filter((p) => p.row === 1)
  const row2 = gridA.jsonPlacements.filter((p) => p.row === 2)
  if (row1.length && row2.length) {
    assert(
      Math.min(...row1.map((p) => p.y)) < Math.min(...row2.map((p) => p.y)),
      'row 1 is closer to top entrance than row 2'
    )
  }
}

const stagger = computeMarketLayout({
  marketDimensions: { width: W, height: H },
  tableDimensions: { width: TW, height: TH },
  totalTables: 12,
  layoutMode: 'staggered',
})

assert(stagger.ok, 'staggered layout succeeds')
if (stagger.ok) {
  const row1Col1 = stagger.jsonPlacements.find((p) => p.row === 1 && p.column === 1)
  const row2Col1 = stagger.jsonPlacements.find((p) => p.row === 2 && p.column === 1)
  if (row1Col1 && row2Col1) {
    assert(
      Math.abs(row2Col1.x - row1Col1.x - TW / 2) < 0.01,
      'even rows (2,4,6…) offset by half table width'
    )
  }
}

const cap = maxPerimeterTableCapacity(W, H, TW, TH)

{
  const over = computeMarketLayout({
    marketDimensions: { width: W, height: H },
    tableDimensions: { width: TW, height: TH },
    totalTables: cap + 5,
    layoutMode: 'perimeter',
  })
  assert(!over.ok, 'perimeter overflow returns error')
  if (!over.ok) {
    assert(over.maxPerimeterCapacity === cap, 'error reports max perimeter capacity')
  }

  const perimeter = computeMarketLayout({
    marketDimensions: { width: W, height: H },
    tableDimensions: { width: TW, height: TH },
    totalTables: Math.min(6, cap),
    layoutMode: 'perimeter',
  })
  assert(perimeter.ok, 'perimeter layout within capacity')
  if (perimeter.ok) {
    assert(perimeter.asciiDiagram.includes('+'), 'ascii diagram has border')
    assert(perimeter.jsonPlacements[0]?.id.startsWith('table_'), 'default table ids')
  }
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
