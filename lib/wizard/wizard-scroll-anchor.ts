/**
 * Reset page scroll when the market wizard changes steps so coordinators
 * land at the top of the new step without hunting for headers or CTAs.
 */
export function resetWizardScrollAnchor(step?: number): void {
  if (typeof window === 'undefined') return
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

  if (step === 3) {
    window.requestAnimationFrame(() => {
      document.getElementById('floor-plan-workspace')?.scrollIntoView({
        block: 'start',
        behavior: 'instant',
      })
    })
  }
}
