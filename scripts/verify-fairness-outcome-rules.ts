/**
 * Fairness outcome classification + split-score business rules.
 * Run: npx tsx scripts/verify-fairness-outcome-rules.ts
 */

import {
  buildLayoutScores,
  classifyLayoutOutcome,
  generateFairLayout,
  generateFairLayoutCandidates,
  isCompleteOutcome,
  type LayoutRequest,
  type LayoutResult,
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
    { id: 'a', width: 10, height: 8 },
    { id: 'b', width: 10, height: 8 },
    { id: 'c', width: 10, height: 8 },
    { id: 'd', width: 10, height: 8 },
    { id: 'e', width: 10, height: 8 },
    { id: 'f', width: 10, height: 8 },
  ],
  entrance: { x: 40, y: 58 },
  exit: { x: 40, y: 2 },
  roomWidthFt: 80,
  roomHeightFt: 60,
}

const overcrowdedRequest: LayoutRequest = {
  room: {
    boundary: [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 20 },
      { x: 0, y: 20 },
    ],
  },
  booths: Array.from({ length: 12 }, (_, i) => ({
    id: `b${i}`,
    width: 10,
    height: 8,
  })),
  entrance: { x: 15, y: 18 },
  exit: { x: 15, y: 2 },
  roomWidthFt: 30,
  roomHeightFt: 20,
}

function assertSplitScores(result: LayoutResult, label: string) {
  assert(result.scores != null, `${label}: scores present`)
  assert(result.outcomeReason != null, `${label}: outcomeReason present`)
  assert(result.capacityReport != null, `${label}: capacityReport present`)
  if (!result.scores) return
  assert(
    result.scores.capacityScore >= 0 && result.scores.capacityScore <= 100,
    `${label}: capacityScore in range`
  )
  assert(
    result.scores.coverageScore >= 0 && result.scores.coverageScore <= 100,
    `${label}: coverageScore in range`
  )
  assert(
    result.scores.fairnessScore >= 0 && result.scores.fairnessScore <= 100,
    `${label}: fairnessScore in range`
  )
  assert(
    result.coveragePercentage === result.scores.coverageScore,
    `${label}: coveragePercentage alias matches coverageScore`
  )
}

function mockRouteCoverage(
  partial: Partial<import('../lib/layout-strategies/fairness-engine/route-coverage').RouteCoverageResult>
): import('../lib/layout-strategies/fairness-engine/route-coverage').RouteCoverageResult {
  return {
    route: [],
    coveragePercentage: 0,
    boothsPassedByRoute: 0,
    totalBooths: 0,
    missedBoothIds: [],
    visitedBoothIds: [],
    isFullCoverage: false,
    missingDoors: false,
    pathfindingFailed: false,
    ...partial,
  }
}

console.log('Fairness outcome rules verification\n')

const complete = generateFairLayout(rectangleRequest)
assertSplitScores(complete, 'rectangle layout')
if (complete.outcomeReason === 'complete') {
  assert(
    complete.scores!.capacityScore === 100,
    'Complete layout has capacityScore 100'
  )
  assert(
    complete.capacityReport!.isPartialLayout === false,
    'Complete layout is not partial'
  )
  assert(isCompleteOutcome(complete.outcomeReason!), 'isCompleteOutcome for complete')
  assert(complete.layoutValid === true, 'Complete layout is layoutValid')
}

const crowded = generateFairLayout(overcrowdedRequest)
assertSplitScores(crowded, 'overcrowded layout')
if (crowded.outcomeReason === 'physical_capacity_exceeded') {
  assert(
    crowded.capacityReport!.removedBoothIds.length > 0 ||
      crowded.scores!.capacityScore < 100,
    'Capacity exceeded yields removals or capacityScore < 100'
  )
  assert(
    crowded.capacityReport!.removalReason === 'physical_capacity_exceeded' ||
      crowded.capacityReport!.removedBoothIds.length === 0,
    'Removal reason is physical_capacity_exceeded when vendors removed'
  )
}

assert(
  classifyLayoutOutcome({
    originalBoothCount: 6,
    placedCount: 6,
    unplacedIds: [],
    routeCoverage: mockRouteCoverage({
      isFullCoverage: true,
      coveragePercentage: 100,
      missedBoothIds: [],
      boothsPassedByRoute: 6,
      totalBooths: 6,
    }),
    optimizationFailure: false,
    algorithmLimited: false,
    removedForCapacity: false,
  }) === 'complete',
  'classifyLayoutOutcome returns complete for full roster + route'
)

assert(
  classifyLayoutOutcome({
    originalBoothCount: 6,
    placedCount: 4,
    unplacedIds: ['e', 'f'],
    routeCoverage: mockRouteCoverage({
      isFullCoverage: false,
      coveragePercentage: 80,
      missedBoothIds: [],
      boothsPassedByRoute: 4,
      totalBooths: 4,
    }),
    optimizationFailure: false,
    algorithmLimited: false,
    removedForCapacity: false,
  }) === 'physical_capacity_exceeded',
  'classifyLayoutOutcome returns physical_capacity_exceeded when booths unplaced'
)

assert(
  classifyLayoutOutcome({
    originalBoothCount: 6,
    placedCount: 6,
    unplacedIds: [],
    routeCoverage: mockRouteCoverage({
      isFullCoverage: false,
      coveragePercentage: 83,
      missedBoothIds: ['c'],
      boothsPassedByRoute: 5,
      totalBooths: 6,
    }),
    optimizationFailure: false,
    algorithmLimited: false,
    removedForCapacity: false,
  }) === 'routing_failure',
  'classifyLayoutOutcome returns routing_failure when geometry fits but tour incomplete'
)

const split = buildLayoutScores({
  originalBoothCount: 10,
  maximumFairCapacity: 8,
  coveragePercentage: 100,
  boothExposures: new Map([
    ['a', 50],
    ['b', 48],
  ]),
})
assert(split.capacityScore === 80, 'buildLayoutScores capacityScore = 80% of roster')
assert(split.coverageScore === 100, 'buildLayoutScores coverageScore rounds coverage')
assert(split.fairnessScore > 0, 'buildLayoutScores fairnessScore > 0 at full coverage')

const candidates = generateFairLayoutCandidates(rectangleRequest, {
  scenarioCount: 3,
  timeBudgetMs: 2400,
})
assert(candidates.length === 3, 'Multi-scenario returns requested count')
for (const [i, c] of candidates.entries()) {
  assertSplitScores(c, `candidate ${i + 1}`)
}
const hasComplete = candidates.some((c) => c.outcomeReason === 'complete')
if (hasComplete) {
  assert(
    candidates[0]!.outcomeReason === 'complete',
    'Full-roster complete candidate ranks first'
  )
}

console.log('')
console.log(`Results: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
