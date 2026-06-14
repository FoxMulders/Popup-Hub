/**
 * Layout strategy regression + fairness fixtures.
 * Run: npx tsx scripts/verify-layout-strategies.ts
 */

import { packBoothsTrafficAware } from '../components/coordinator/floor-plan-v2/engine/AutoArrangeEngine'
import {
  defaultLayoutOrchestrator,
  generateFairLayout,
  LayoutMode,
  trafficAwareStrategy,
  computeFairnessScore,
  type LayoutRequest,
} from '../lib/layout-strategies'

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

function placementsMatch(
  a: Array<{ id: string; x: number; y: number; rotation: number }>,
  b: Array<{ boothId: string; x: number; y: number; rotation: number }>
): boolean {
  if (a.length !== b.length) return false
  const byId = new Map(b.map((p) => [p.boothId, p]))
  return a.every((p) => {
    const other = byId.get(p.id)
    if (!other) return false
    return (
      Math.abs(p.x - other.x) < 1e-6 &&
      Math.abs(p.y - other.y) < 1e-6 &&
      Math.abs(p.rotation - other.rotation) < 1e-6
    )
  })
}

const rectangleRequest: LayoutRequest = {
  room: {
    boundary: [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 60 },
      { x: 0, y: 60 },
    ],
  },
  booths: [
    { id: 'a', width: 8, height: 6 },
    { id: 'b', width: 8, height: 6 },
    { id: 'c', width: 8, height: 6 },
    { id: 'd', width: 8, height: 6 },
    { id: 'e', width: 8, height: 6 },
    { id: 'f', width: 8, height: 6 },
  ],
  entrance: { x: 40, y: 2 },
  exit: { x: 40, y: 58 },
  roomWidthFt: 80,
  roomHeightFt: 60,
  obstacles: [{ x: 36, y: 28, width: 8, height: 6 }],
  aisleFt: 3,
  stepFt: 0.5,
}

async function main() {
const legacyTraffic = packBoothsTrafficAware(80, 60, rectangleRequest.booths, {
  entrance: rectangleRequest.entrance,
  exit: rectangleRequest.exit,
  obstacles: rectangleRequest.obstacles,
  aisleWidth: 3,
  stepFt: 0.5,
})

const strategyTraffic = await trafficAwareStrategy.generateLayout(rectangleRequest)

assert(
  placementsMatch(legacyTraffic.placed, strategyTraffic.placements),
  'TrafficAwareStrategy matches legacy packBoothsTrafficAware (rectangle 6 booths)'
)

assert(
  strategyTraffic.fairnessScore >= 0 && strategyTraffic.fairnessScore <= 100,
  `TrafficAwareStrategy fairness score in range (${strategyTraffic.fairnessScore})`
)

assert(strategyTraffic.route.length >= 2, 'TrafficAwareStrategy returns patron route')

const orchestratorTraffic = await defaultLayoutOrchestrator.generateLayout(
  LayoutMode.TRAFFIC_AWARE,
  rectangleRequest
)

assert(
  placementsMatch(legacyTraffic.placed, orchestratorTraffic.placements),
  'Orchestrator TRAFFIC_AWARE matches legacy engine'
)

const fairRect = generateFairLayout(rectangleRequest)
assert(fairRect.placements.length >= 4, `Fairness rectangle places booths (${fairRect.placements.length})`)
assert(
  fairRect.fairnessScore >= 0 && fairRect.fairnessScore <= 100,
  `Fairness score valid (${fairRect.fairnessScore})`
)

const lShapeRequest: LayoutRequest = {
  ...rectangleRequest,
  room: {
    boundary: [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 40 },
      { x: 30, y: 40 },
      { x: 30, y: 60 },
      { x: 0, y: 60 },
    ],
  },
  roomWidthFt: 60,
  roomHeightFt: 60,
  entrance: { x: 30, y: 2 },
  exit: { x: 15, y: 58 },
}

const fairL = generateFairLayout(lShapeRequest)
assert(fairL.placements.length >= 2, `Fairness L-shape places booths (${fairL.placements.length})`)

const tenBooths: LayoutRequest = {
  ...rectangleRequest,
  booths: Array.from({ length: 10 }, (_, i) => ({
    id: `t-${i}`,
    width: 6,
    height: 4,
  })),
}

const fair10 = generateFairLayout(tenBooths)
assert(fair10.placements.length >= 6, `Fairness 10-booth room (${fair10.placements.length} placed)`)

const fiftyBooths: LayoutRequest = {
  ...rectangleRequest,
  roomWidthFt: 120,
  roomHeightFt: 100,
  room: {
    boundary: [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 100 },
      { x: 0, y: 100 },
    ],
  },
  entrance: { x: 60, y: 4 },
  exit: { x: 60, y: 96 },
  booths: Array.from({ length: 50 }, (_, i) => ({
    id: `f-${i}`,
    width: 6,
    height: 4,
  })),
}

const fair50 = generateFairLayout(fiftyBooths)
assert(
  fair50.placements.length >= 8,
  `Fairness 50-booth stress (${fair50.placements.length} placed, score ${fair50.fairnessScore})`
)

const equalScores = new Map([
  ['a', 0.5],
  ['b', 0.5],
  ['c', 0.5],
])
const unequalScores = new Map([
  ['a', 1],
  ['b', 0.1],
  ['c', 0.1],
])
assert(
  computeFairnessScore(equalScores) > computeFairnessScore(unequalScores),
  'Fairness scorer ranks balanced exposure higher'
)

console.log('')
console.log(`Results: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
