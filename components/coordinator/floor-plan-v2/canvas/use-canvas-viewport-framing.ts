'use client'

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

export interface UseCanvasViewportFramingOptions {
  /** Pan/zoom scroll container — must fill the observed host when measurable. */
  scrollRef: RefObject<HTMLDivElement | null>
  /** Background layout host (toolbar flex sibling) observed for size changes. */
  containerRef: RefObject<HTMLElement | null>
  /** Re-frame when room dimensions / active room / open canvas size changes. */
  framingKey: string
  /** Fit + center callback; should return the zoom level chosen for the fit. */
  onFrame: () => number | undefined
  /** When false, skip ResizeObserver (page-scroll QA wizard mode). */
  observeContainer?: boolean
}

/**
 * Initial fit before paint + responsive re-fit when the layout host resizes
 * (window chrome, inspector toggle, toolbar wrap). Observes the parent
 * background container rather than relying on static height fallbacks.
 */
export function useCanvasViewportFraming({
  scrollRef,
  containerRef,
  framingKey,
  onFrame,
  observeContainer = true,
}: UseCanvasViewportFramingOptions): void {
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useLayoutEffect(() => {
    onFrameRef.current()
  }, [framingKey])

  useEffect(() => {
    if (!observeContainer) return
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return

    let rafId: number | null = null
    const scheduleFrame = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        const scroll = scrollRef.current
        if (!scroll) return
        const w = scroll.clientWidth
        const h = scroll.clientHeight
        if (w <= 0 || h <= 0) return
        onFrameRef.current()
      })
    }

    const observer = new ResizeObserver(scheduleFrame)
    observer.observe(container)
    scheduleFrame()

    return () => {
      observer.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [containerRef, observeContainer, scrollRef])
}

/** Zoom multiplier where 1.0 = baseline fit-to-viewport (100% UI readout). */
export function normalizeViewportZoom(
  zoom: number,
  fitReferenceZoom: number
): number {
  const ref = fitReferenceZoom > 0 ? fitReferenceZoom : 1
  return zoom / ref
}
