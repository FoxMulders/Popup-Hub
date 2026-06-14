/** Fairness score 0–100 from exposure distribution (100 = perfectly balanced). */

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

export function exposureVariance(scores: Map<string, number>): number {
  if (scores.size === 0) return 0
  const values = [...scores.values()]
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
}
