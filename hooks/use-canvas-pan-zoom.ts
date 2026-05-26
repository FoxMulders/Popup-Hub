'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  LAYOUT_ZOOM_DEFAULT,
  LAYOUT_ZOOM_MAX,
  LAYOUT_ZOOM_MIN,
  LAYOUT_ZOOM_STEP,
} from '@/components/coordinator/layout-zoom-slider'

function clampZoom(value: number): number {
  return Math.min(LAYOUT_ZOOM_MAX, Math.max(LAYOUT_ZOOM_MIN, value))
}

export interface UseCanvasPanZoomOptions {
  scrollRef: RefObject<HTMLElement | null>
  initialZoom?: number
}

interface ActivePointer {
  pointerId: number
  pointerType: string
  clientX: number
  clientY: number
}

interface PanState {
  pointerId: number
  startClientX: number
  startClientY: number
  scrollLeft: number
  scrollTop: number
}

interface PinchState {
  pointerIds: [number, number]
  startDistance: number
  startZoom: number
  /** Anchor point in *page* (clientX/clientY) space at gesture start. */
  anchorClientX: number
  anchorClientY: number
  /** Anchor offset from the scroll container's top-left in pre-zoom px. */
  anchorContentX: number
  anchorContentY: number
  /** Latest distance — used to throttle setState writes inside RAF. */
  latestDistance: number
  /** Latest midpoint — used to translate the viewport during pinch. */
  latestMidClientX: number
  latestMidClientY: number
}

function distance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

/**
 * Canvas viewport pan + zoom controller with full multi-pointer touch
 * support. Behavior:
 *
 *   • Mouse: middle-button drag, or Space + left-button drag, pans the
 *     viewport. Ctrl/⌘ + wheel zooms (cursor-anchored).
 *   • Touch (single finger): drags the viewport directly. Native CSS
 *     scrolling is disabled on the container so we control the
 *     trajectory and prevent the page from scrolling under the canvas.
 *   • Touch (two fingers): pinch-to-zoom, anchored to the midpoint
 *     between fingers, with simultaneous pan as the midpoint moves.
 *
 * Zoom updates are batched through `requestAnimationFrame` so a fast
 * pinch never blocks the input thread for >16 ms.
 */
export function useCanvasPanZoom({ scrollRef, initialZoom = LAYOUT_ZOOM_DEFAULT }: UseCanvasPanZoomOptions) {
  const [zoom, setZoomState] = useState(initialZoom)
  const [isPanning, setIsPanning] = useState(false)

  // Mirror `zoom` in a ref so RAF-driven pinch handlers can read the
  // latest value without re-binding the closure on every state change.
  const zoomRef = useRef(initialZoom)
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const activePointers = useRef<Map<number, ActivePointer>>(new Map())
  const panRef = useRef<PanState | null>(null)
  const pinchRef = useRef<PinchState | null>(null)
  const spaceHeldRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)

  const setZoom = useCallback((next: number) => {
    const clamped = clampZoom(next)
    zoomRef.current = clamped
    setZoomState(clamped)
  }, [])

  const onZoomChange = useCallback(
    (next: number) => {
      setZoom(next)
    },
    [setZoom]
  )

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLElement>) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const delta = event.deltaY > 0 ? -LAYOUT_ZOOM_STEP : LAYOUT_ZOOM_STEP
      setZoom(zoomRef.current + delta)
    },
    [setZoom]
  )

  /**
   * RAF tick that flushes the latest pinch frame: applies the new zoom
   * level and translates `scrollLeft`/`scrollTop` so the gesture
   * midpoint stays anchored to the same content coordinate.
   */
  const flushPinch = useCallback(() => {
    rafIdRef.current = null
    const pinch = pinchRef.current
    const el = scrollRef.current
    if (!pinch || !el) return
    const ratio = pinch.latestDistance / Math.max(pinch.startDistance, 1)
    const targetZoom = clampZoom(pinch.startZoom * ratio)

    const rect = el.getBoundingClientRect()
    // Where the user's fingers are inside the scroll container right now.
    const midViewportX = pinch.latestMidClientX - rect.left
    const midViewportY = pinch.latestMidClientY - rect.top
    // Where the same content coordinate maps to under the *new* zoom.
    const newScrollLeft = pinch.anchorContentX * targetZoom - midViewportX
    const newScrollTop = pinch.anchorContentY * targetZoom - midViewportY

    setZoom(targetZoom)
    el.scrollLeft = newScrollLeft
    el.scrollTop = newScrollTop
  }, [scrollRef, setZoom])

  const schedulePinchFlush = useCallback(() => {
    if (rafIdRef.current !== null) return
    rafIdRef.current = requestAnimationFrame(flushPinch)
  }, [flushPinch])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const el = scrollRef.current
      if (!el) return

      // Track every active pointer for multi-touch arithmetic.
      activePointers.current.set(event.pointerId, {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        clientX: event.clientX,
        clientY: event.clientY,
      })

      const pointers = Array.from(activePointers.current.values())

      // Mouse pan: middle button OR Space + left button.
      const isMouseLikePan =
        event.pointerType === 'mouse' &&
        (event.button === 1 || (event.button === 0 && spaceHeldRef.current))

      // Touch / pen drag: any single non-mouse pointer pans by default
      // so users can drag the canvas with one finger.
      const isTouchPan = event.pointerType !== 'mouse' && pointers.length === 1

      if (isMouseLikePan || isTouchPan) {
        event.preventDefault()
        panRef.current = {
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          scrollLeft: el.scrollLeft,
          scrollTop: el.scrollTop,
        }
        setIsPanning(true)
        try {
          el.setPointerCapture(event.pointerId)
        } catch {
          /* setPointerCapture can throw on detached elements */
        }
        return
      }

      // Pinch start: second touch point joins, upgrade single-finger
      // pan into a pinch-zoom + pan gesture.
      if (event.pointerType !== 'mouse' && pointers.length === 2) {
        const [a, b] = pointers
        const startDistance = Math.max(distance(a, b), 1)
        const midClientX = (a.clientX + b.clientX) / 2
        const midClientY = (a.clientY + b.clientY) / 2
        const rect = el.getBoundingClientRect()
        const currentZoom = zoomRef.current
        // Convert finger midpoint to content coordinates (pre-zoom px).
        const anchorContentX = (midClientX - rect.left + el.scrollLeft) / currentZoom
        const anchorContentY = (midClientY - rect.top + el.scrollTop) / currentZoom

        pinchRef.current = {
          pointerIds: [a.pointerId, b.pointerId],
          startDistance,
          startZoom: currentZoom,
          anchorClientX: midClientX,
          anchorClientY: midClientY,
          anchorContentX,
          anchorContentY,
          latestDistance: startDistance,
          latestMidClientX: midClientX,
          latestMidClientY: midClientY,
        }
        // Cancel any single-finger pan in progress so the second
        // finger doesn't fight the pan handler.
        if (panRef.current) {
          try {
            el.releasePointerCapture(panRef.current.pointerId)
          } catch {
            /* noop */
          }
          panRef.current = null
        }
        setIsPanning(true)
      }
    },
    [scrollRef]
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const el = scrollRef.current
      if (!el) return
      const tracked = activePointers.current.get(event.pointerId)
      if (tracked) {
        tracked.clientX = event.clientX
        tracked.clientY = event.clientY
      }

      // Pinch path takes precedence: when two fingers are active we
      // batch zoom + pan updates through a single RAF frame.
      const pinch = pinchRef.current
      if (
        pinch &&
        (event.pointerId === pinch.pointerIds[0] || event.pointerId === pinch.pointerIds[1])
      ) {
        const a = activePointers.current.get(pinch.pointerIds[0])
        const b = activePointers.current.get(pinch.pointerIds[1])
        if (!a || !b) return
        pinch.latestDistance = Math.max(distance(a, b), 1)
        pinch.latestMidClientX = (a.clientX + b.clientX) / 2
        pinch.latestMidClientY = (a.clientY + b.clientY) / 2
        schedulePinchFlush()
        return
      }

      const pan = panRef.current
      if (pan && pan.pointerId === event.pointerId) {
        el.scrollLeft = pan.scrollLeft - (event.clientX - pan.startClientX)
        el.scrollTop = pan.scrollTop - (event.clientY - pan.startClientY)
      }
    },
    [scrollRef, schedulePinchFlush]
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const el = scrollRef.current
      activePointers.current.delete(event.pointerId)

      const pinch = pinchRef.current
      if (
        pinch &&
        (event.pointerId === pinch.pointerIds[0] || event.pointerId === pinch.pointerIds[1])
      ) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        pinchRef.current = null
        // If one finger is still down, demote pinch to a fresh pan
        // anchored at that surviving pointer.
        const surviving = Array.from(activePointers.current.values()).find(
          (p) => p.pointerType !== 'mouse'
        )
        if (surviving && el) {
          panRef.current = {
            pointerId: surviving.pointerId,
            startClientX: surviving.clientX,
            startClientY: surviving.clientY,
            scrollLeft: el.scrollLeft,
            scrollTop: el.scrollTop,
          }
          try {
            el.setPointerCapture(surviving.pointerId)
          } catch {
            /* noop */
          }
        } else {
          setIsPanning(false)
        }
        return
      }

      const pan = panRef.current
      if (pan && pan.pointerId === event.pointerId) {
        panRef.current = null
        try {
          el?.releasePointerCapture(event.pointerId)
        } catch {
          /* noop */
        }
        if (activePointers.current.size === 0) setIsPanning(false)
      }
    },
    [scrollRef]
  )

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.code === 'Space' && !event.repeat) {
      spaceHeldRef.current = true
    }
  }, [])

  const onKeyUp = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.code === 'Space') {
      spaceHeldRef.current = false
    }
  }, [])

  // Cleanup any in-flight RAF on unmount.
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  return {
    zoom,
    onZoomChange,
    panHandlers: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onKeyDown,
      onKeyUp,
      tabIndex: 0,
      role: 'application' as const,
      'aria-label': 'Floor plan canvas viewport',
      // Disabling native pan/zoom is required for our pointer-driven
      // gesture handling to win against the browser's default
      // touch-pan / pinch-zoom on the document. Without this the
      // browser scrolls the *page* under the canvas.
      style: { touchAction: 'none' as const },
    },
    isPanning,
  }
}
