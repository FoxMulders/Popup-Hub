'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * Edge auto-scroll for canvas drag interactions.
 *
 * When the user holds the LMB (`buttons === 1`) and drags the
 * pointer past the bounding rectangle of `scrollRef`, the viewport
 * smoothly scrolls in the direction of the overshoot at a velocity
 * proportional to how far past the edge the cursor sits — so a
 * cursor a hair outside nudges, and a cursor near the screen edge
 * scrolls quickly. The loop is driven by `requestAnimationFrame`
 * and terminates instantly on `pointerup`, `pointercancel`, or
 * the moment `buttons` drops below 1 (the user released LMB or
 * tabbed away mid-gesture).
 *
 * Pointer-coord re-fire:
 * Most canvas pointer hooks convert client coords → doc-space coords
 * by reading `surface.getBoundingClientRect()` on every pointermove.
 * When the cursor sits still outside the viewport but we keep
 * scrolling, no real `pointermove` fires, so the dragged object
 * appears to detach from the cursor. After every successful scroll
 * tick we therefore dispatch a synthetic `pointermove` carrying the
 * cursor's last known client position; downstream hooks pick it up
 * and recompute the dragged object's doc-space coord against the
 * freshly-shifted surface rect, keeping the object glued to the
 * conceptual cursor location.
 *
 * Velocity model:
 *   - `EDGE_PAD_PX`: distance past the edge before the loop kicks
 *     in. Set to 0 so a cursor *just* leaving the viewport already
 *     scrolls (matches the spec: "moves outside the boundary").
 *   - `MAX_VELOCITY_PX`: per-frame cap. With a 60 Hz monitor this
 *     ceilings the scroll at ~1500 px/s — fast but not jarring.
 *   - `VELOCITY_PER_PX`: ramp factor. At 0.5 px-per-px-of-overshoot
 *     a cursor 50 px past the edge advances 25 px/frame ≈ 1500 px/s,
 *     hitting the cap exactly when overshoot reaches 50 px.
 */
const EDGE_PAD_PX = 0
const MAX_VELOCITY_PX = 25
const VELOCITY_PER_PX = 0.5

export interface EdgeAutoScrollOptions {
  /**
   * When false, the hook attaches no listeners. Lets callers gate
   * the behaviour off when the canvas isn't visible (e.g. another
   * wizard step has the floor plan unmounted but kept alive).
   */
  enabled?: boolean
}

interface PointerSample {
  clientX: number
  clientY: number
  pointerId: number
  pointerType: string
}

/** Pure helper: how far is the pointer past each edge of `rect`? */
export function computeEdgeOvershoot(
  clientX: number,
  clientY: number,
  rect: { left: number; right: number; top: number; bottom: number },
  pad = EDGE_PAD_PX,
  perPx = VELOCITY_PER_PX,
  maxV = MAX_VELOCITY_PX
): { dx: number; dy: number } {
  let dx = 0
  let dy = 0
  if (clientX < rect.left - pad) {
    dx = -Math.min(maxV, (rect.left - pad - clientX) * perPx)
  } else if (clientX > rect.right + pad) {
    dx = Math.min(maxV, (clientX - rect.right - pad) * perPx)
  }
  if (clientY < rect.top - pad) {
    dy = -Math.min(maxV, (rect.top - pad - clientY) * perPx)
  } else if (clientY > rect.bottom + pad) {
    dy = Math.min(maxV, (clientY - rect.bottom - pad) * perPx)
  }
  return { dx, dy }
}

/**
 * React hook: attach window-level edge auto-scroll behaviour for
 * the scroll container at `scrollRef`. Idempotent — multiple
 * calls with the same ref attach exactly one listener pair (React
 * cleans up on unmount via `useEffect`'s teardown).
 */
export function useEdgeAutoScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  options: EdgeAutoScrollOptions = {}
) {
  const enabled = options.enabled ?? true
  const rafRef = useRef<number | null>(null)
  const sampleRef = useRef<PointerSample | null>(null)

  useEffect(() => {
    if (!enabled) return

    function stopLoop() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    function tick() {
      const scroll = scrollRef.current
      const sample = sampleRef.current
      if (!scroll || !sample) {
        rafRef.current = null
        return
      }
      const rect = scroll.getBoundingClientRect()
      const { dx, dy } = computeEdgeOvershoot(
        sample.clientX,
        sample.clientY,
        rect
      )
      if (dx === 0 && dy === 0) {
        rafRef.current = null
        return
      }
      const beforeLeft = scroll.scrollLeft
      const beforeTop = scroll.scrollTop
      scroll.scrollLeft += dx
      scroll.scrollTop += dy
      const movedX = scroll.scrollLeft !== beforeLeft
      const movedY = scroll.scrollTop !== beforeTop
      // If we hit the scroll extents and nothing actually moved,
      // there's no point re-firing pointermove — the surface didn't
      // shift, so the dragged object's coord wouldn't change either.
      // Keep the rAF loop alive so a smaller drag-back inside the
      // viewport resumes immediately, but skip the synthetic event.
      if ((movedX || movedY) && typeof window !== 'undefined') {
        try {
          const synthetic = new PointerEvent('pointermove', {
            clientX: sample.clientX,
            clientY: sample.clientY,
            buttons: 1,
            pointerId: sample.pointerId,
            pointerType: sample.pointerType,
            bubbles: true,
            cancelable: true,
          })
          window.dispatchEvent(synthetic)
        } catch {
          // PointerEvent constructor isn't supported in some test
          // jigs — fail silent so production code keeps working.
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    function startLoop() {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(tick)
    }

    function handlePointerMove(e: PointerEvent) {
      // Only auto-scroll while the LMB is actively held (buttons===1).
      // Hover, right-click drags (buttons===2), and middle-click pans
      // (buttons===4) are intentionally excluded.
      if (e.buttons !== 1) {
        sampleRef.current = null
        stopLoop()
        return
      }
      sampleRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
      }
      const scroll = scrollRef.current
      if (!scroll) return
      const rect = scroll.getBoundingClientRect()
      const { dx, dy } = computeEdgeOvershoot(e.clientX, e.clientY, rect)
      if (dx === 0 && dy === 0) {
        stopLoop()
      } else {
        startLoop()
      }
    }

    function handlePointerEnd() {
      sampleRef.current = null
      stopLoop()
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    window.addEventListener('blur', handlePointerEnd)

    return () => {
      stopLoop()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
      window.removeEventListener('blur', handlePointerEnd)
    }
  }, [scrollRef, enabled])
}
