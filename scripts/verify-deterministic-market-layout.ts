/**
 * Deterministic market layout verification.
 * Run: npx tsx scripts/verify-deterministic-market-layout.ts
 */

import {
  generateDeterministicMarketLayout,
  maxPerimeterTableCapacity,
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
const ids = (n: number) => Array.from({ length: n }, (_, i) => `t-${i}`)

const gridA = generateDeterministicMarketLayout({
  marketWidthFt: W,
  marketHeightFt: H,
  tableWidthFt: TW,
  tableHeightFt: TH,
  tableCount: 8,
  tableIds: ids(8),
  layoutMode: 'grid',
  entrance: { x: W / 2, y: H },
})

const gridB = generateDeterministicMarketLayout({
  marketWidthFt: W,
  marketHeightFt: H,
  tableWidthFt: TW,
  tableHeightFt: TH,
  tableCount: 8,
  tableIds: ids(8),
  layoutMode: 'grid',
  entrance: { x: W / 2, y: H },
})

assert(gridA.ok && gridB.ok, 'grid layout succeeds')
if (gridA.ok && gridB.ok) {
  const sigA = JSON.stringify(gridA.placements)
  const sigB = JSON.stringify(gridB.placements)
  assert(sigA === sigB, 'grid layout is deterministic (identical runs)')
  assert(
    gridA.placements.every((p) => p.rotation === 0),
    'grid uses 0° rotation only'
  )
  const row0 = gridA.placements.filter((p) => p.row === 0)
  assert(row0.length > 0, 'grid has a front row')
  const maxY0 = Math.max(...row0.map((p) => p.y))
  const row1 = gridA.placements.filter((p) => p.row === 1)
  if (row1.length > 0) {
    assert(
      Math.max(...row1.map((p) => p.y)) < maxY0 - 1,
      'row 1 is behind row 0 when entrance is at bottom'
    )
  }
}

const stagger = generateDeterministicMarketLayout({
  marketWidthFt: W,
  marketHeightFt: H,
  tableWidthFt: TW,
  tableHeightFt: TH,
  tableCount: 12,
  tableIds: ids(12),
  layoutMode: 'staggered',
})

assert(stagger.ok, 'staggered layout succeeds')
if (stagger.ok) {
  const odd = stagger.placements.filter((p) => p.row % 2 === 1)
  const even = stagger.placements.filter((p) => p.row % 2 === 0)
  if (odd.length && even.length) {
    const minOddX = Math.min(...odd.map((p) => p.x))
    const minEvenX = Math.min(...even.map((p) => p.x))
    assert(
      Math.abs(minOddX - minEvenX - TW / 2) < 0.01,
      'odd rows offset by half table width'
    )
  }
}

const cap = maxPerimeterTableCapacity(W, H, TW, TH)
const over = generateDeterministicMarketLayout({
  marketWidthFt: W,
  marketHeightFt: H,
  tableWidthFt: TW,
  tableHeightFt: TH,
  tableCount: cap + 5,
  tableIds: ids(cap + 5),
  layoutMode: 'perimeter',
})

assert(!over.ok && 'maxPerimeterCapacity' in over, 'perimeter overflow returns error')
if (!over.ok) {
  assert(over.maxPerimeterCapacity === cap, 'error reports max perimeter capacity')
}

const perimeter = generateDeterministicMarketLayout({
  marketWidthFt: W,
  marketHeightFt: H,
  tableWidthFt: TW,
  tableHeightFt: TH,
  tableCount: Math.min(6, cap),
  tableIds: ids(Math.min(6, cap)),
  layoutMode: 'perimeter',
})

assert(perimeter.ok, 'perimeter layout within capacity')
if (perimeter.ok) {
  assert(perimeter.asciiDiagram.includes('+'), 'ascii diagram has border')
  assert(perimeter.explanation.length > 20, 'explanation is non-empty')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
