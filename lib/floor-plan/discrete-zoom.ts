/** Toolbar-friendly zoom steps — snaps in/out controls to crisp percentages. */
export const DISCRETE_ZOOM_LEVELS = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3,
] as const

export function snapZoomToDiscreteLevel(
  zoom: number,
  min: number = DISCRETE_ZOOM_LEVELS[0]
): number {
  const levels = DISCRETE_ZOOM_LEVELS.filter((level) => level >= min)
  if (levels.length === 0) return min
  let best = levels[0]!
  let bestDelta = Math.abs(zoom - best)
  for (const level of levels) {
    const delta = Math.abs(zoom - level)
    if (delta < bestDelta) {
      best = level
      bestDelta = delta
    }
  }
  return best
}

export function nextDiscreteZoomLevel(
  current: number,
  direction: 'in' | 'out',
  min: number = DISCRETE_ZOOM_LEVELS[0]
): number {
  const levels = DISCRETE_ZOOM_LEVELS.filter((level) => level >= min)
  if (levels.length === 0) return min
  const snapped = snapZoomToDiscreteLevel(current, min)
  const index = levels.indexOf(snapped as (typeof levels)[number])
  const resolvedIndex = index >= 0 ? index : 0
  if (direction === 'in') {
    return levels[Math.min(resolvedIndex + 1, levels.length - 1)]!
  }
  return levels[Math.max(resolvedIndex - 1, 0)]!
}

export function formatDiscreteZoomPercent(zoom: number, min?: number): string {
  return `${Math.round(snapZoomToDiscreteLevel(zoom, min) * 100)}%`
}
