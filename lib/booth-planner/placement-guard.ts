/** Hard ceiling on coordinate-evaluation steps inside placement loops. */
export const MAX_PLACEMENT_STEP_EVALUATIONS = 5000

export const AUTO_PLAN_CAPACITY_LIMIT_MESSAGE =
  '⚠️ CAPACITY REACHED: Could not place remaining vendors. Lower your target booth caps or clear room space.'

/** Tracks placement loop steps; trips when MAX_PLACEMENT_STEP_EVALUATIONS is exceeded. */
export class PlacementIterationBudget {
  count = 0
  exceeded = false

  /** Increment counter; returns true when the budget is exhausted. */
  tick(): boolean {
    if (this.exceeded) return true
    this.count += 1
    if (this.count > MAX_PLACEMENT_STEP_EVALUATIONS) {
      this.exceeded = true
      return true
    }
    return false
  }
}

/** Yield one animation frame — keeps the UI thread responsive during batched layout. */
export function nextAnimationFrame(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}
