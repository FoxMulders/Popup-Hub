import {
  BOOTH_VIEWING_DISTANCE_FT,
  DEFAULT_ATTENDEE_COUNT,
} from '@/lib/vendor-fairness-layout/constants'
import type { FairnessDiagnostics, FairnessReport, Point } from '../types'
import type { PlacedBoothState } from './exposure-simulator'
import type { ExposureSimResult } from './exposure-simulator'
import { evaluateFairness, exposureVariance } from './fairness-scorer'
import type { RouteCoverageResult } from './route-coverage'

function exposureHistogram(
  exposures: Map<string, number>
): FairnessDiagnostics['exposureHistogram'] {
  const buckets = [
    { bucket: '0–20%', count: 0 },
    { bucket: '20–40%', count: 0 },
    { bucket: '40–60%', count: 0 },
    { bucket: '60–80%', count: 0 },
    { bucket: '80–100%', count: 0 },
  ]
  for (const pct of exposures.values()) {
    if (pct < 20) buckets[0]!.count++
    else if (pct < 40) buckets[1]!.count++
    else if (pct < 60) buckets[2]!.count++
    else if (pct < 80) buckets[3]!.count++
    else buckets[4]!.count++
  }
  return buckets
}

function extremaBoothIds(exposures: Map<string, number>): {
  lowest: string | null
  highest: string | null
} {
  if (exposures.size === 0) return { lowest: null, highest: null }
  let lowest: string | null = null
  let highest: string | null = null
  let min = Infinity
  let max = -Infinity
  for (const [id, v] of exposures) {
    if (v < min) {
      min = v
      lowest = id
    }
    if (v > max) {
      max = v
      highest = id
    }
  }
  return { lowest, highest }
}

export function buildFairnessDiagnostics(input: {
  simulation: ExposureSimResult
  routeCoverage: RouteCoverageResult
  placed: PlacedBoothState[]
}): FairnessDiagnostics {
  const { simulation, routeCoverage, placed } = input
  const exposures = simulation.exposurePercentages
  const evaluation = evaluateFairness(
    exposures,
    routeCoverage.coveragePercentage,
    routeCoverage.missedBoothIds
  )
  const { lowest, highest } = extremaBoothIds(exposures)

  return {
    coveragePercentage: routeCoverage.coveragePercentage,
    exposureVariance: evaluation.exposureVariance,
    lowestExposureBoothId: lowest,
    highestExposureBoothId: highest,
    exposureHistogram: exposureHistogram(exposures),
    exposureHeatmap: placed.map((p) => ({
      boothId: p.booth.id,
      x: p.x + p.booth.width / 2,
      y: p.y + p.booth.height / 2,
      value: (exposures.get(p.booth.id) ?? 0) / 100,
    })),
    missedBoothIds: routeCoverage.missedBoothIds,
    meets80PercentRule: evaluation.meets80PercentRule,
    layoutValid: evaluation.layoutValid,
  }
}

export function buildFairnessReport(input: {
  route: Point[]
  placed: PlacedBoothState[]
  simulation: ExposureSimResult
  routeCoverage: RouteCoverageResult
  evaluation: ReturnType<typeof evaluateFairness>
  attendeeCount: number
  randomnessFt: number
}): FairnessReport {
  const diagnostics = buildFairnessDiagnostics({
    simulation: input.simulation,
    routeCoverage: input.routeCoverage,
    placed: input.placed,
  })

  const scoreFormula =
    'fairnessScore = round(100 × (1 − normalizedVariance)) on per-booth pass-by %; score is 0 when route coverage < 100%.'

  const steps: FairnessReport['steps'] = [
    {
      label: 'Patron route',
      value: `${input.route.length} path points`,
      detail: 'PathfindingService A* booth tour (entry → every booth → exit).',
    },
    {
      label: 'Route coverage',
      value: `${diagnostics.coveragePercentage.toFixed(1)}%`,
      detail:
        diagnostics.missedBoothIds.length > 0
          ? `${input.routeCoverage.boothsPassedByRoute}/${input.routeCoverage.totalBooths} booths passed — missed: ${diagnostics.missedBoothIds.join(', ')}`
          : `All ${input.placed.length} placed booth(s) visited by the tour.`,
    },
    {
      label: 'Patron simulation',
      value: input.attendeeCount,
      detail: `${input.attendeeCount} patrons along route ±${input.randomnessFt.toFixed(1)} ft; visibility ${BOOTH_VIEWING_DISTANCE_FT} ft.`,
    },
    {
      label: 'Exposure variance',
      value: exposureVariance(input.simulation.exposurePercentages).toFixed(2),
      detail: 'Variance of pass-by percentages (0–100).',
    },
    {
      label: '80% relative rule',
      value: diagnostics.meets80PercentRule ? 'PASS' : 'FAIL',
      detail: 'Each booth must receive ≥ 80% of highest-exposure booth pass-bys.',
    },
    {
      label: 'Raw fairness score',
      value: input.evaluation.rawFairnessScore,
      detail: 'Exposure variance score before route-coverage cap.',
    },
    {
      label: 'Fairness score',
      value: input.evaluation.fairnessScore,
      detail: input.evaluation.scoreCappedDueToRoute
        ? `Score 0 (raw ${input.evaluation.rawFairnessScore}) — patron tour must pass every booth.`
        : input.evaluation.layoutValid
          ? 'Valid layout — score reflects exposure balance.'
          : 'Partial route coverage — fairness score is 0.',
    },
  ]

  if (input.evaluation.scoreCappedDueToRoute) {
    steps.splice(steps.length - 1, 0, {
      label: 'Coverage gate',
      value: 'Score 0',
      detail:
        input.evaluation.scoreCapReason ??
        'Score is 0 because the patron tour does not pass every booth.',
    })
  }

  if (diagnostics.lowestExposureBoothId) {
    steps.push({
      label: 'Lowest exposure booth',
      value: diagnostics.lowestExposureBoothId,
      detail: `${(input.simulation.exposurePercentages.get(diagnostics.lowestExposureBoothId) ?? 0).toFixed(1)}% pass-by rate.`,
    })
  }
  if (diagnostics.highestExposureBoothId) {
    steps.push({
      label: 'Highest exposure booth',
      value: diagnostics.highestExposureBoothId,
      detail: `${(input.simulation.exposurePercentages.get(diagnostics.highestExposureBoothId) ?? 0).toFixed(1)}% pass-by rate.`,
    })
  }

  const summary = input.evaluation.layoutValid
    ? `Fairness ${input.evaluation.fairnessScore}/100 — 100% route coverage, variance ${input.evaluation.exposureVariance.toFixed(2)}${diagnostics.meets80PercentRule ? '' : ' (80% rule failed)'}.`
    : input.evaluation.scoreCappedDueToRoute
      ? `Invalid layout — route covers ${diagnostics.coveragePercentage.toFixed(0)}% of booths (${diagnostics.missedBoothIds.length} missed); fairness score 0 (raw ${input.evaluation.rawFairnessScore}).`
      : `Partial route coverage (${diagnostics.coveragePercentage.toFixed(0)}%) — fairness score 0.`

  return { summary, scoreFormula, steps, diagnostics }
}

export function exposureHeatmapGrid(
  diagnostics: FairnessDiagnostics,
  cellFt = 4
): Array<{ x: number; y: number; size: number; value: number }> {
  if (diagnostics.exposureHeatmap.length === 0) return []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const h of diagnostics.exposureHeatmap) {
    if (h.x < minX) minX = h.x
    if (h.y < minY) minY = h.y
    if (h.x > maxX) maxX = h.x
    if (h.y > maxY) maxY = h.y
  }
  const grid = new Map<string, { sum: number; count: number }>()

  for (const h of diagnostics.exposureHeatmap) {
    const col = Math.floor((h.x - minX) / cellFt)
    const row = Math.floor((h.y - minY) / cellFt)
    const key = `${col},${row}`
    const cell = grid.get(key) ?? { sum: 0, count: 0 }
    cell.sum += h.value
    cell.count++
    grid.set(key, cell)
  }

  const out: Array<{ x: number; y: number; size: number; value: number }> = []
  for (const [key, cell] of grid) {
    const [col, row] = key.split(',').map(Number) as [number, number]
    out.push({
      x: minX + col * cellFt,
      y: minY + row * cellFt,
      size: cellFt,
      value: cell.count > 0 ? cell.sum / cell.count : 0,
    })
  }
  void maxX
  void maxY
  return out
}

export function exposureHeatmapToClearanceField(
  heatmap: Array<{ x: number; y: number; size: number; value: number }> | undefined,
  originX: number,
  originY: number
): Array<{
  x: number
  y: number
  sizeFt: number
  clearanceFt: number
  band: 'critical' | 'tight' | 'good'
}> {
  if (!heatmap?.length) return []
  return heatmap.map((cell) => ({
    x: cell.x + originX,
    y: cell.y + originY,
    sizeFt: cell.size,
    clearanceFt: Math.max(0, cell.value) * BOOTH_VIEWING_DISTANCE_FT,
    band: (cell.value >= 0.8 ? 'good' : cell.value >= 0.5 ? 'tight' : 'critical') as
      | 'critical'
      | 'tight'
      | 'good',
  }))
}

export { DEFAULT_ATTENDEE_COUNT }
