import type { ExposureMetrics, FairnessBreakdown, Point, RotatedBooth } from '../types'
import { boothCenter } from '../geometry/booth-rect'

export function exposureVariance(scores: number[]): number {
  if (scores.length === 0) return 0
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  return scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length
}

export function standardDeviation(scores: number[]): number {
  return Math.sqrt(exposureVariance(scores))
}

/** fairnessScore = 100 - normalizedExposureVariance (0–100, 100 = perfectly balanced). */
export function computeFairnessScore(
  metrics: ExposureMetrics[],
  booths: RotatedBooth[]
): FairnessBreakdown {
  const scores = metrics.map((m) => m.score)
  const variance = exposureVariance(scores)
  const stdDev = standardDeviation(scores)
  const maxPossibleVariance = 0.25
  const normalizedVariance = Math.min(1, variance / maxPossibleVariance)
  const fairnessScore = Math.round(Math.max(0, Math.min(100, 100 - normalizedVariance * 100)))

  const boothScores = new Map<string, number>()
  for (const m of metrics) boothScores.set(m.boothId, m.score)

  const heatmap = booths.map((b) => {
    const c = boothCenter(b)
    const score = boothScores.get(b.id) ?? 0
    return { x: c.x, y: c.y, value: score }
  })

  return {
    fairnessScore,
    exposureVariance: variance,
    normalizedVariance,
    boothScores,
    heatmap,
  }
}

export function heatmapGrid(
  heatmap: Array<{ x: number; y: number; value: number }>,
  cellFt: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): Array<{ x: number; y: number; size: number; value: number }> {
  const cols = Math.ceil((bounds.maxX - bounds.minX) / cellFt)
  const rows = Math.ceil((bounds.maxY - bounds.minY) / cellFt)
  const grid = new Map<string, { sum: number; count: number }>()

  for (const h of heatmap) {
    const col = Math.floor((h.x - bounds.minX) / cellFt)
    const row = Math.floor((h.y - bounds.minY) / cellFt)
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
      x: bounds.minX + col * cellFt,
      y: bounds.minY + row * cellFt,
      size: cellFt,
      value: cell.count > 0 ? cell.sum / cell.count : 0,
    })
  }
  return out
}
