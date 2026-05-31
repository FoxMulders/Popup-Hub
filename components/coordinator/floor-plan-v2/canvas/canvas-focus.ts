/** Scroll viewport id — focus target for wheel zoom / pan after toolbar actions. */
export const FLOOR_PLAN_CANVAS_ID = 'floor-plan-canvas'

/**
 * Return focus to the floor plan scroll viewport so wheel / trackpad gestures
 * are not captured by toolbar buttons after a mutation.
 */
export function focusFloorPlanCanvas(): void {
  if (typeof document === 'undefined') return
  requestAnimationFrame(() => {
    const el =
      document.getElementById(FLOOR_PLAN_CANVAS_ID) ??
      document.querySelector<HTMLElement>(
        '[aria-label="Floor plan canvas viewport"]'
      )
    if (el instanceof HTMLElement) {
      el.focus({ preventScroll: true })
    }
  })
}
