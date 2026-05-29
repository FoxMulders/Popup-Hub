'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'
import { hitTest, type Point, type ViewportTransform } from './geometry'
import type { BoothObject, PlacedObject } from '../state/types'

/** Delay before the category label appears — matches the spec. */
export const BOOTH_CATEGORY_TOOLTIP_DELAY_MS = 2000

export interface BoothCategoryTooltipState {
  label: string
  /** Viewport X (px) — positions a `fixed` tooltip near the cursor. */
  x: number
  /** Viewport Y (px). */
  y: number
}

interface UseBoothCategoryTooltipOptions {
  surfaceRef: RefObject<SVGSVGElement | null>
  transform: ViewportTransform
  objects: ReadonlyArray<PlacedObject>
  /**
   * When true, hover tracking is suspended (active pan, draw, drag,
   * rotate, marquee, etc.) so tooltips never fight gestures.
   */
  disabled?: boolean
}

export function useBoothCategoryTooltip({
  surfaceRef,
  transform,
  objects,
  disabled = false,
}: UseBoothCategoryTooltipOptions) {
  const [tooltip, setTooltip] = useState<BoothCategoryTooltipState | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingBoothIdRef = useRef<string | null>(null)
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null)

  const clearPending = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    pendingBoothIdRef.current = null
  }, [])

  const hideTooltip = useCallback(() => {
    clearPending()
    setTooltip(null)
  }, [clearPending])

  const ftAt = useCallback(
    (clientX: number, clientY: number): Point => {
      const surface = surfaceRef.current
      if (!surface) return { x: 0, y: 0 }
      const rect = surface.getBoundingClientRect()
      const px = clientX - rect.left
      const py = clientY - rect.top
      const ratio = transform.basePxPerFt * transform.zoom
      if (ratio === 0) return { x: 0, y: 0 }
      return { x: px / ratio, y: py / ratio }
    },
    [surfaceRef, transform.basePxPerFt, transform.zoom]
  )

  const boothAt = useCallback(
    (clientX: number, clientY: number): BoothObject | null => {
      const hit = hitTest(objects, ftAt(clientX, clientY))
      if (!hit || hit.kind !== 'booth') return null
      return hit as BoothObject
    },
    [ftAt, objects]
  )

  const onMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLElement>) => {
      if (disabled || e.buttons !== 0) {
        hideTooltip()
        return
      }

      const booth = boothAt(e.clientX, e.clientY)
      if (!booth) {
        hideTooltip()
        return
      }

      const label = booth.categoryName?.trim()
      if (!label) {
        hideTooltip()
        return
      }

      // Tooltip already visible for this booth — follow the cursor
      // without restarting the delay.
      if (
        tooltip &&
        pendingBoothIdRef.current === booth.id &&
        tooltip.label === label
      ) {
        setTooltip({ label, x: e.clientX, y: e.clientY })
        return
      }

      // Still counting down on the same booth — keep the timer but
      // track the latest pointer so the popover lands near the cursor.
      if (pendingBoothIdRef.current === booth.id && hoverTimeoutRef.current) {
        pendingPointerRef.current = { x: e.clientX, y: e.clientY }
        return
      }

      clearPending()
      pendingBoothIdRef.current = booth.id
      pendingPointerRef.current = { x: e.clientX, y: e.clientY }
      hoverTimeoutRef.current = setTimeout(() => {
        hoverTimeoutRef.current = null
        const pt = pendingPointerRef.current
        if (!pt || pendingBoothIdRef.current !== booth.id) return
        setTooltip({ label, x: pt.x, y: pt.y })
      }, BOOTH_CATEGORY_TOOLTIP_DELAY_MS)
    },
    [boothAt, clearPending, disabled, hideTooltip, tooltip]
  )

  const onMouseLeave = useCallback(() => {
    hideTooltip()
  }, [hideTooltip])

  useEffect(() => {
    if (disabled) hideTooltip()
  }, [disabled, hideTooltip])

  useEffect(() => () => hideTooltip(), [hideTooltip])

  return {
    tooltip,
    onMouseMove,
    onMouseLeave,
  }
}
