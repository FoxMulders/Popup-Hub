/**
 * Layout strategy regression + fairness fixtures.
 * Run: npx tsx scripts/verify-layout-strategies.ts
 */

import { packBoothsTrafficAware } from '../components/coordinator/floor-plan-v2/engine/AutoArrangeEngine'
import {
  defaultLayoutOrchestrator,
  generateFairLayout,
  generateFairLayoutCandidates,
  pickBestFairLayoutCandidate,
  resolveFairLayoutScenarioCount,
  LayoutMode,
  trafficAwareStrategy,
  computeFairnessScore,
  evaluateFairness,
  meetsRelativeExposureThreshold,
  type LayoutRequest,
  type LayoutResult,
  type BoothPlacement,
} from '../lib/layout-strategies'
import { allPointsInRoom } from '../lib/vendor-fairness-layout/geometry/polygon'
import { boothRotatedCorners } from '../lib/layout-strategies/fairness-engine/placement-validator'

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

function assertFairnessConstraints(
  label: string,
  request: LayoutRequest,
  placements: BoothPlacement[],
  minScoreWhenPlaced = 1
) {
  const boothById = new Map(request.booths.map((b) => [b.id, b]))
  for (const p of placements) {
    const booth = boothById.get(p.boothId)
    assert(Boolean(booth), `${label}: booth ${p.boothId} resolved`)
    if (!booth) continue
    const corners = boothRotatedCorners(p.x, p.y, booth, p.rotation)
    assert(
      corners.every((c) => pointInRoom(c, request.room.boundary)),
      `${label}: ${p.boothId} inside room polygon`
    )
  }

  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i]!
      const b = placements[j]!
      const boothA = boothById.get(a.boothId)!
      const boothB = boothById.get(b.boothId)!
      const aabbA = boothRotatedCorners(a.x, a.y, boothA, a.rotation)
      const aabbB = boothRotatedCorners(b.x, b.y, boothB, b.rotation)
      const minAx = Math.min(...aabbA.map((c) => c.x))
      const maxAx = Math.max(...aabbA.map((c) => c.x))
      const minAy = Math.min(...aabbA.map((c) => c.y))
      const maxAy = Math.max(...aabbA.map((c) => c.y))
      const minBx = Math.min(...aabbB.map((c) => c.x))
      const maxBx = Math.max(...aabbB.map((c) => c.x))
      const minBy = Math.min(...aabbB.map((c) => c.y))
      const maxBy = Math.max(...aabbB.map((c) => c.y))
      const aisle = request.aisleFt ?? 3
      const overlap =
        minAx - aisle < maxBx &&
        maxAx + aisle > minBx &&
        minAy - aisle < maxBy &&
        maxAy + aisle > minBy
      assert(!overlap, `${label}: ${a.boothId} vs ${b.boothId} clearance`)
    }
  }
}

function pointInRoom(p: { x: number; y: number }, boundary: LayoutRequest['room']['boundary']) {
  return allPointsInRoom([p], boundary)
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
  entrance: { x: 40, y: 58 },
  exit: { x: 40, y: 2 },
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
assertFairnessConstraints('Fairness rectangle', rectangleRequest, fairRect.placements)
assert(
  typeof fairRect.coveragePercentage === 'number',
  'Fairness rectangle reports coveragePercentage'
)
assert(
  fairRect.report != null && fairRect.report.steps.length >= 4,
  'Fairness rectangle generates structured report'
)
assert(
  fairRect.route.length >= 2,
  `Fairness rectangle returns PathfindingService route (${fairRect.route.length} pts)`
)
if (fairRect.layoutValid) {
  assert(
    fairRect.coveragePercentage === 100,
    `Valid layout has 100% coverage (${fairRect.coveragePercentage})`
  )
  assert(
    fairRect.fairnessScore >= 1 && fairRect.fairnessScore <= 100,
    `Valid layout fairness score (${fairRect.fairnessScore})`
  )
} else {
  assert(
    fairRect.fairnessScore === 0,
    `Invalid layout scores 0 (coverage ${fairRect.coveragePercentage}%)`
  )
}

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
assertFairnessConstraints('Fairness L-shape', lShapeRequest, fairL.placements)
assert(
  fairL.report?.summary.includes('Fairness') || fairL.report?.summary.includes('invalid'),
  'Fairness L-shape report has summary'
)

const irregularRequest: LayoutRequest = {
  ...rectangleRequest,
  room: {
    boundary: [
      { x: 0, y: 20 },
      { x: 40, y: 0 },
      { x: 80, y: 10 },
      { x: 70, y: 50 },
      { x: 30, y: 60 },
      { x: 0, y: 40 },
    ],
  },
  roomWidthFt: 80,
  roomHeightFt: 60,
  entrance: { x: 40, y: 55 },
  exit: { x: 15, y: 52 },
}

const fairIrregular = generateFairLayout(irregularRequest)
assert(
  fairIrregular.placements.length >= 2,
  `Fairness irregular polygon places booths (${fairIrregular.placements.length})`
)
assertFairnessConstraints(
  'Fairness irregular',
  irregularRequest,
  fairIrregular.placements
)
assert(
  fairIrregular.route.length >= 2,
  `Fairness irregular returns pathfinding route (${fairIrregular.route.length} pts)`
)

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
if (fair10.placements.length >= 4) {
  assertFairnessConstraints('Fairness 10-booth', tenBooths, fair10.placements)
}

const equalScores = new Map([
  ['a', 80],
  ['b', 80],
  ['c', 80],
])
const unequalScores = new Map([
  ['a', 100],
  ['b', 10],
  ['c', 10],
])
assert(
  computeFairnessScore(equalScores) > computeFairnessScore(unequalScores),
  'Fairness scorer ranks balanced exposure higher'
)

const partialCoverageEval = evaluateFairness(equalScores, 75)
assert(
  partialCoverageEval.fairnessScore === 0 &&
    partialCoverageEval.layoutValid === false,
  'Partial route coverage yields score 0 and invalid layout'
)

const fullCoverageEval = evaluateFairness(equalScores, 100)
assert(
  fullCoverageEval.layoutValid && fullCoverageEval.fairnessScore === 100,
  'Full coverage balanced exposures score 100'
)

const rankFull: LayoutResult = {
  placements: [],
  fairnessScore: 75,
  route: [],
  coveragePercentage: 100,
  layoutValid: true,
  scenarioId: 'full',
}
const rankPartial: LayoutResult = {
  placements: [],
  fairnessScore: 79,
  route: [],
  coveragePercentage: 67,
  layoutValid: false,
  scenarioId: 'partial',
}
assert(
  pickBestFairLayoutCandidate([rankPartial, rankFull]).scenarioId === 'full',
  'Multi-scenario ranking prefers full route coverage over higher partial score'
)

assert(
  meetsRelativeExposureThreshold(
    new Map([
      ['a', 100],
      ['b', 85],
    ])
  ),
  '80% relative exposure rule passes when min >= 80% of max'
)
assert(
  !meetsRelativeExposureThreshold(
    new Map([
      ['a', 100],
      ['b', 50],
    ])
  ),
  '80% relative exposure rule fails when min < 80% of max'
)

assert(
  resolveFairLayoutScenarioCount(50) >= 5,
  `Scenario count for 50 booths (${resolveFairLayoutScenarioCount(50)})`
)
assert(
  resolveFairLayoutScenarioCount(220) === 3,
  `Scenario count capped for 220 booths (${resolveFairLayoutScenarioCount(220)})`
)

const multiStart = performance.now()
const multiCandidates = generateFairLayoutCandidates(rectangleRequest, {
  scenarioCount: 5,
  timeBudgetMs: 3200,
})
const multiElapsed = performance.now() - multiStart
assert(
  multiCandidates.length === 5,
  `Multi-scenario fairness returns 5 candidates (${multiCandidates.length})`
)
assert(
  multiCandidates.every(
    (c) =>
      c.scenarioId &&
      c.fairnessScore >= 0 &&
      c.fairnessScore <= 100 &&
      c.placements.length >= 1 &&
      c.report != null
  ),
  'Each fairness scenario has id, score, placements, and report'
)
const bestCov = multiCandidates[0]!.coveragePercentage ?? 0
const hasFullCandidate = multiCandidates.some(
  (c) => (c.coveragePercentage ?? 0) >= 100 || c.layoutValid === true
)
if (hasFullCandidate) {
  assert(
    (multiCandidates[0]!.coveragePercentage ?? 0) >= 100 ||
      multiCandidates[0]!.layoutValid === true,
    'When full-coverage scenarios exist, best candidate has 100% route coverage'
  )
} else {
  assert(
    bestCov >= (multiCandidates[multiCandidates.length - 1]!.coveragePercentage ?? 0),
    'Fairness candidates ranked by coverage when none reach 100%'
  )
}
assert(
  pickBestFairLayoutCandidate(multiCandidates).scenarioId ===
    multiCandidates[0]!.scenarioId,
  'pickBestFairLayoutCandidate returns top-ranked scenario'
)
assertFairnessConstraints(
  'Multi-scenario best',
  rectangleRequest,
  multiCandidates[0]!.placements
)
console.log(
  `Multi-scenario 6-booth rectangle: ${multiElapsed.toFixed(0)}ms for 5 scenarios`
)

console.log('')
console.log(`Results: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
