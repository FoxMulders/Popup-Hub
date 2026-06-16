/** Fairness score 0–100 from route-based booth exposure variance (100 = perfectly balanced). */

export const RELATIVE_EXPOSURE_THRESHOLD = 0.8

/** Fairness score when circulation route does not pass every placed booth. */
export const MAX_FAIRNESS_SCORE_PARTIAL_ROUTE = 0

export interface FairnessEvaluation {
  fairnessScore: number
  rawFairnessScore: number
  exposureVariance: number
  meets80PercentRule: boolean
  layoutValid: boolean
  scoreCappedDueToRoute: boolean
  scoreCapReason?: string
}

export interface RouteCoverageCapResult {
  score: number
  capped: boolean
  rawScore: number
  coveragePercentage: number
  maxWithoutFullCoverage: number
}

export function exposureVariance(scores: Map<string, number>): number {
  if (scores.size === 0) return 0
  const values = [...scores.values()]
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
}

export function computeFairnessScore(scores: Map<string, number>): number {
  if (scores.size === 0) return 100
  const values = [...scores.values()]
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean <= 1e-9) return 0
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  const normalizedVariance = Math.min(1, variance / (mean * mean + 1e-9))
  return Math.round(Math.max(0, Math.min(100, 100 * (1 - normalizedVariance))))
}

/**
 * Zero fairness score when route coverage is below 100%.
 * @param coveragePercentage 0–100 scale.
 */
export function applyRouteCoverageScoreCap(
  rawScore: number,
  coveragePercentage: number
): RouteCoverageCapResult {
  const maxWithoutFullCoverage = MAX_FAIRNESS_SCORE_PARTIAL_ROUTE
  const fullCoverage = coveragePercentage >= 100 - 1e-6
  if (fullCoverage) {
    return {
      score: rawScore,
      capped: false,
      rawScore,
      coveragePercentage,
      maxWithoutFullCoverage,
    }
  }
  return {
    score: 0,
    capped: rawScore > 0,
    rawScore,
    coveragePercentage,
    maxWithoutFullCoverage,
  }
}

export function buildScoreCapReason(
  coveragePercentage: number,
  missedCount: number
): string {
  const pct = Math.round(coveragePercentage)
  if (missedCount === 0) {
    return `Route coverage ${pct}% — fairness score is 0 until every booth is passed by the patron tour.`
  }
  const boothLabel = missedCount === 1 ? 'booth' : 'booths'
  return `Route coverage ${pct}% (${missedCount} ${boothLabel} not passed) — fairness score is 0 until coverage is 100%.`
}

/** Every booth must receive at least 80% of the highest-exposure booth. */
export function meetsRelativeExposureThreshold(
  scores: Map<string, number>,
  threshold = RELATIVE_EXPOSURE_THRESHOLD
): boolean {
  if (scores.size === 0) return true
  const values = [...scores.values()]
  const max = Math.max(...values)
  if (max <= 1e-9) return false
  const minRequired = max * threshold
  return values.every((v) => v >= minRequired - 1e-6)
}

export function computeCapacityScore(
  originalBoothCount: number,
  maximumFairCapacity: number
): number {
  if (originalBoothCount <= 0) return 100
  return Math.round(
    Math.max(0, Math.min(100, (100 * maximumFairCapacity) / originalBoothCount))
  )
}

export function computeCoverageScore(coveragePercentage: number): number {
  return Math.round(Math.max(0, Math.min(100, coveragePercentage)))
}

/** Exposure balance only — no route cap (use coverageScore separately). */
export function computeExposureFairnessScore(
  boothExposures: Map<string, number>,
  coverageScore: number
): number {
  if (coverageScore < 100 - 1e-6 || boothExposures.size === 0) return 0
  return computeFairnessScore(boothExposures)
}

export function buildLayoutScores(input: {
  originalBoothCount: number
  maximumFairCapacity: number
  coveragePercentage: number
  boothExposures: Map<string, number>
}): {
  capacityScore: number
  coverageScore: number
  fairnessScore: number
  rawFairnessScore: number
} {
  const capacityScore = computeCapacityScore(
    input.originalBoothCount,
    input.maximumFairCapacity
  )
  const coverageScore = computeCoverageScore(input.coveragePercentage)
  const rawFairnessScore = computeFairnessScore(input.boothExposures)
  const fairnessScore = computeExposureFairnessScore(
    input.boothExposures,
    coverageScore
  )
  return { capacityScore, coverageScore, fairnessScore, rawFairnessScore }
}

/**
 * Evaluate fairness from per-booth exposure percentages (0–100).
 * Legacy combined evaluation — prefer buildLayoutScores for new code.
 */
export function evaluateFairness(
  boothExposures: Map<string, number>,
  coveragePercentage: number,
  missedBoothIds: string[] = []
): FairnessEvaluation {
  const fullCoverage = coveragePercentage >= 100 - 1e-6
  const variance = exposureVariance(boothExposures)
  const rawScore =
    boothExposures.size === 0 ? 0 : computeFairnessScore(boothExposures)
  const cap = applyRouteCoverageScoreCap(rawScore, coveragePercentage)
  const meets80 = meetsRelativeExposureThreshold(boothExposures)

  return {
    fairnessScore: cap.score,
    rawFairnessScore: rawScore,
    exposureVariance: variance,
    meets80PercentRule: meets80,
    layoutValid: fullCoverage && boothExposures.size > 0,
    scoreCappedDueToRoute: cap.capped,
    scoreCapReason: cap.capped
      ? buildScoreCapReason(coveragePercentage, missedBoothIds.length)
      : undefined,
  }
}
