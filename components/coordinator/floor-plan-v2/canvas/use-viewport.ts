'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent,
} from 'react'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 3
const ZOOM_STEP = 0.05

export interface ViewportState {
  zoom: number
  isPanning: boolean
  panActive: boolean
}

export interface ZoomMath {
  /** Pixels per foot at zoom = 1.0. */
  basePxPerFt: number
  /** Padding around the venue rectangle, in feet, on each side. */
  padFt: number
  /**
   * Where to anchor "discrete" zoom changes (buttons, reset, programmatic
   * setZoom calls). In feet, doc-space. The scroll container is adjusted
   * so this point sits at the center of the visible viewport after a
   * zoom change.
   *
   * Wheel and pinch zoom override this with a screen-space anchor so the
   * cursor / finger midpoint remain locked in place — that's the more
   * natural behavior for those input modalities.
   */
  anchorFt: { x: number; y: number }
}

export interface UseViewportOptions {
  scrollRef: RefObject<HTMLDivElement | null>
  initialZoom?: number
  /** Floor for fit/zoom-out; default 0.25. Command center uses ~0.72 for steadier drags. */
  zoomMin?: number
  /** Multiplier on wheel/button zoom step; lower = less jumpy (default 4). */
  zoomStepMultiplier?: number
  /**
   * Read on every zoom event. Returning a fresh value from the closure
   * (rather than passing as a prop) avoids re-binding the handlers on
   * every render and lets us pull the *latest* anchor from the host's
   * selection state without React stale-closure pitfalls.
   */
  getZoomMath: () => ZoomMath
  /**
   * Optional accessor that returns the host's currently-active tool.
   * When provided, single-touch drags on the scroll container are
   * routed into a pan if the tool is `'hand'`. Mouse panning still
   * uses middle-click / Shift+drag and doesn't depend on this.
   */
  getToolMode?: () => 'hand' | 'select' | 'draw'
}

export interface ViewportApi extends ViewportState {
  setZoom: (next: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  /** Reset zoom to 100% and re-center the scroll viewport on the doc anchor. */
  resetViewport: () => void
  /**
   * Reset zoom to 1.0 *and* scroll the canvas so the doc anchor
   * (current selection or room center) sits in the centre of the
   * viewport. Distinct from `resetZoom`: when zoom is already 1.0
   * `resetZoom` no-ops, but `centerView` always re-centres the scroll
   * — so users who have panned away can recover the original framing
   * with a single click.
   */
  centerView: () => void
  /**
   * Frame an arbitrary doc-ft rectangle: pick the largest zoom (clamped
   * to the [ZOOM_MIN, ZOOM_MAX] range) that lets `bounds` fit inside
   * the visible viewport with `padding` percent of breathing room on
   * each side, then scroll so the bbox centroid sits at the viewport
   * centre.
   *
   * Used by the toolbar "Center" button to recompose the camera around
   * the union of every placed object — so a single click always recovers
   * "show me everything I've drawn" regardless of how the user has
   * panned or zoomed.
   *
   * `padding` defaults to 0.1 (10% margin per side). Pass 0 for an
   * edge-to-edge fit (e.g., when the caller has already padded the
   * input bbox). Empty / zero-size bboxes are treated as no-ops.
   */
  fitToBounds: (
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options?: { padding?: number }
  ) => void
  /**
   * Like `fitToBounds`, but picks zoom by stepping down from `zoomMax`
   * (default 1.0) in multiplicative `stepFactor` decrements (default
   * 0.8) until the bounds fit — used for adaptive multi-room framing.
   */
  fitToBoundsStepped: (
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options?: { padding?: number; stepFactor?: number; zoomMax?: number }
  ) => void
  scrollHandlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void
    onWheel: (e: WheelEvent<HTMLDivElement>) => void
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
    onKeyUp: (e: React.KeyboardEvent<HTMLDivElement>) => void
  }
}

interface ActivePointer {
  pointerId: number
  pointerType: string
  clientX: number
  clientY: number
}

interface PanInternal {
  pointerId: number
  startClientX: number
  startClientY: number
  scrollLeft: number
  scrollTop: number
}

interface PinchInternal {
  pointerIds: [number, number]
  startDistance: number
  startZoom: number
}

function clampZoom(z: number, min = ZOOM_MIN): number {
  return Math.min(ZOOM_MAX, Math.max(min, z))
}

function distance(a: ActivePointer, b: ActivePointer): number {
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

/**
 * Compute the scrollLeft/scrollTop that puts a doc-ft anchor at a
 * specific local pixel inside the scroll container.
 *
 *   visibleScreenPx = (padFt + anchorFt) * pxPerFt - scrollOffset
 *   ⇒ scrollOffset = (padFt + anchorFt) * pxPerFt - visibleScreenPx
 *
 * Negative scroll positions are clamped to 0 — browsers refuse them.
 */
function computeScroll(
  anchorFtX: number,
  anchorFtY: number,
  pxPerFt: number,
  padFt: number,
  localScreenX: number,
  localScreenY: number
): { left: number; top: number } {
  const left = (padFt + anchorFtX) * pxPerFt - localScreenX
  const top = (padFt + anchorFtY) * pxPerFt - localScreenY
  return { left: Math.max(0, left), top: Math.max(0, top) }
}

export function useViewport(options: UseViewportOptions): ViewportApi {
  const {
    scrollRef,
    initialZoom = 1,
    getZoomMath,
    getToolMode,
    zoomMin = ZOOM_MIN,
    zoomStepMultiplier = 4,
  } = options
  const clamp = useCallback((z: number) => clampZoom(z, zoomMin), [zoomMin])
  const zoomStepMulRef = useRef(zoomStepMultiplier)
  useEffect(() => {
    zoomStepMulRef.current = zoomStepMultiplier
  }, [zoomStepMultiplier])

  const [zoom, setZoomState] = useState(initialZoom)
  const [isPanning, setIsPanning] = useState(false)
  const [panActive, setPanActive] = useState(false)

  // Mirror the tool-mode accessor in a ref so pointer callbacks see
  // the latest tool without re-binding on every host render.
  const getToolModeRef = useRef(getToolMode)
  useEffect(() => {
    getToolModeRef.current = getToolMode
  }, [getToolMode])

  // Mirror `zoom` into a ref so RAF / pointer-callback closures can
  // read the latest value without re-binding. Updated in an effect to
  // satisfy React's "don't write refs during render" rule.
  const zoomRef = useRef(initialZoom)
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  // Stash the latest math accessor in a ref so the keyboard / wheel /
  // pointer callbacks always see the current selection-aware anchor
  // without having `getZoomMath` in their dependency arrays.
  const getZoomMathRef = useRef(getZoomMath)
  useEffect(() => {
    getZoomMathRef.current = getZoomMath
  }, [getZoomMath])

  const activePointers = useRef<Map<number, ActivePointer>>(new Map())
  const panRef = useRef<PanInternal | null>(null)
  const pinchRef = useRef<PinchInternal | null>(null)
  const spaceHeldRef = useRef(false)

  /**
   * Pending scroll, applied in a layout effect after `zoom` updates.
   *
   * We can't write scroll synchronously alongside `setZoomState` because
   * the document's pixel size depends on zoom (the SVG scales with it),
   * and the new size only exists after React commits. A layout effect
   * runs after the DOM mutation but before the browser paints, so the
   * user only sees one repaint at the new zoom with the anchor still
   * locked in place.
   */
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const target = pendingScrollRef.current
    if (!target) return
    const scroll = scrollRef.current
    if (!scroll) {
      pendingScrollRef.current = null
      return
    }
    scroll.scrollLeft = target.left
    scroll.scrollTop = target.top
    pendingScrollRef.current = null
  }, [scrollRef, zoom])

  /**
   * Apply a zoom change anchored to a screen-local pixel position
   * inside the scroll container. The doc-ft point currently under that
   * pixel stays under that pixel after the zoom commits.
   */
  const applyZoomAtScreen = useCallback(
    (nextZoom: number, localScreenX: number, localScreenY: number) => {
      const scroll = scrollRef.current
      const oldZoom = zoomRef.current
      const clamped = clamp(nextZoom)
      if (clamped === oldZoom) return
      if (!scroll) {
        setZoomState(clamped)
        return
      }
      const math = getZoomMathRef.current()
      const oldPxPerFt = math.basePxPerFt * oldZoom
      const newPxPerFt = math.basePxPerFt * clamped

      // Doc-ft point currently under (localScreenX, localScreenY).
      const innerPxX = scroll.scrollLeft + localScreenX
      const innerPxY = scroll.scrollTop + localScreenY
      const anchorFtX = innerPxX / oldPxPerFt - math.padFt
      const anchorFtY = innerPxY / oldPxPerFt - math.padFt

      pendingScrollRef.current = computeScroll(
        anchorFtX,
        anchorFtY,
        newPxPerFt,
        math.padFt,
        localScreenX,
        localScreenY
      )
      setZoomState(clamped)
    },
    [scrollRef, clamp]
  )

  /**
   * Apply a zoom change anchored to a doc-ft point. Used by zoom
   * buttons, the reset button, and any external `setZoom` calls. The
   * doc anchor is taken from `getZoomMath().anchorFt`, which the host
   * computes as the selection-bbox centroid (when something is
   * selected) or the room center (when nothing is selected).
   */
  const applyZoomAtDocAnchor = useCallback(
    (nextZoom: number) => {
      const scroll = scrollRef.current
      const oldZoom = zoomRef.current
      const clamped = clamp(nextZoom)
      if (clamped === oldZoom) return
      if (!scroll) {
        setZoomState(clamped)
        return
      }
      const math = getZoomMathRef.current()
      const newPxPerFt = math.basePxPerFt * clamped
      const localScreenX = scroll.clientWidth / 2
      const localScreenY = scroll.clientHeight / 2

      pendingScrollRef.current = computeScroll(
        math.anchorFt.x,
        math.anchorFt.y,
        newPxPerFt,
        math.padFt,
        localScreenX,
        localScreenY
      )
      setZoomState(clamped)
    },
    [scrollRef, clamp]
  )

  const setZoom = useCallback(
    (next: number) => {
      applyZoomAtDocAnchor(next)
    },
    [applyZoomAtDocAnchor]
  )

  const zoomIn = useCallback(
    () =>
      applyZoomAtDocAnchor(
        zoomRef.current + ZOOM_STEP * zoomStepMulRef.current
      ),
    [applyZoomAtDocAnchor]
  )
  const zoomOut = useCallback(
    () =>
      applyZoomAtDocAnchor(
        zoomRef.current - ZOOM_STEP * zoomStepMulRef.current
      ),
    [applyZoomAtDocAnchor]
  )
  const resetZoom = useCallback(
    () => applyZoomAtDocAnchor(1),
    [applyZoomAtDocAnchor]
  )

  /**
   * Center the doc anchor in the viewport without short-circuiting on
   * "zoom is already 1.0". `applyZoomAtDocAnchor` bails when the zoom
   * delta is zero, which makes it useless when the user has panned but
   * not zoomed; this re-runs the same scroll math directly so the
   * viewport always re-centres.
   */
  const centerView = useCallback(() => {
    const scroll = scrollRef.current
    if (!scroll) {
      setZoomState(1)
      return
    }
    const math = getZoomMathRef.current()
    const targetZoom = clamp(1)
    const newPxPerFt = math.basePxPerFt * targetZoom
    const localScreenX = scroll.clientWidth / 2
    const localScreenY = scroll.clientHeight / 2
    const target = computeScroll(
      math.anchorFt.x,
      math.anchorFt.y,
      newPxPerFt,
      math.padFt,
      localScreenX,
      localScreenY
    )
    if (zoomRef.current !== targetZoom) {
      pendingScrollRef.current = target
      setZoomState(targetZoom)
    } else {
      // Same zoom — apply scroll synchronously; no React commit
      // needed because the document's pixel size is unchanged.
      scroll.scrollLeft = target.left
      scroll.scrollTop = target.top
    }
  }, [scrollRef, clamp])

  const resetViewport = useCallback(() => {
    centerView()
  }, [centerView])

  /**
   * Pick the zoom that makes a doc-ft `bounds` fit inside the visible
   * viewport (with `padding` percent of breathing room per side), then
   * centre the bbox in the viewport. This is the math behind the
   * toolbar "Center" button — so one click always frames everything
   * the user has drawn, regardless of where they panned to.
   */
  const fitToBounds = useCallback<ViewportApi['fitToBounds']>(
    (bounds, options) => {
      const padding = options?.padding ?? 0.1
      const scroll = scrollRef.current
      const widthFt = bounds.maxX - bounds.minX
      const heightFt = bounds.maxY - bounds.minY
      if (widthFt <= 0 || heightFt <= 0) return
      if (!scroll) return

      const math = getZoomMathRef.current()
      const viewportPxW = scroll.clientWidth
      const viewportPxH = scroll.clientHeight
      if (viewportPxW <= 0 || viewportPxH <= 0) return

      // Reserve `padding` of viewport on each side, but never less
      // than a few px on tiny / dimensionless viewports — otherwise
      // the resulting zoom would explode toward infinity.
      const usableW = Math.max(40, viewportPxW * (1 - padding * 2))
      const usableH = Math.max(40, viewportPxH * (1 - padding * 2))

      const zoomForWidth = usableW / (widthFt * math.basePxPerFt)
      const zoomForHeight = usableH / (heightFt * math.basePxPerFt)
      const targetZoom = clamp(Math.min(zoomForWidth, zoomForHeight))

      const newPxPerFt = math.basePxPerFt * targetZoom
      const centerXFt = (bounds.minX + bounds.maxX) / 2
      const centerYFt = (bounds.minY + bounds.maxY) / 2
      const target = computeScroll(
        centerXFt,
        centerYFt,
        newPxPerFt,
        math.padFt,
        viewportPxW / 2,
        viewportPxH / 2
      )

      if (zoomRef.current !== targetZoom) {
        pendingScrollRef.current = target
        setZoomState(targetZoom)
      } else {
        scroll.scrollLeft = target.left
        scroll.scrollTop = target.top
      }
    },
    [scrollRef, clamp]
  )

  const fitToBoundsStepped = useCallback<ViewportApi['fitToBoundsStepped']>(
    (bounds, options) => {
      const padding = options?.padding ?? 0.12
      const stepFactor = options?.stepFactor ?? 0.8
      const zoomMax = options?.zoomMax ?? 1
      const scroll = scrollRef.current
      const widthFt = bounds.maxX - bounds.minX
      const heightFt = bounds.maxY - bounds.minY
      if (widthFt <= 0 || heightFt <= 0) return
      if (!scroll) return

      const math = getZoomMathRef.current()
      const viewportPxW = scroll.clientWidth
      const viewportPxH = scroll.clientHeight
      if (viewportPxW <= 0 || viewportPxH <= 0) return

      const usableW = Math.max(40, viewportPxW * (1 - padding * 2))
      const usableH = Math.max(40, viewportPxH * (1 - padding * 2))

      let targetZoom = zoomMax
      while (targetZoom >= zoomMin) {
        const pxPerFt = math.basePxPerFt * targetZoom
        if (
          widthFt * pxPerFt <= usableW &&
          heightFt * pxPerFt <= usableH
        ) {
          break
        }
        targetZoom *= stepFactor
      }
      targetZoom = clamp(targetZoom)

      const newPxPerFt = math.basePxPerFt * targetZoom
      const centerXFt = (bounds.minX + bounds.maxX) / 2
      const centerYFt = (bounds.minY + bounds.maxY) / 2
      const target = computeScroll(
        centerXFt,
        centerYFt,
        newPxPerFt,
        math.padFt,
        viewportPxW / 2,
        viewportPxH / 2
      )

      if (zoomRef.current !== targetZoom) {
        pendingScrollRef.current = target
        setZoomState(targetZoom)
      } else {
        scroll.scrollLeft = target.left
        scroll.scrollTop = target.top
      }
    },
    [scrollRef, clamp, zoomMin]
  )

  const onWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const scroll = scrollRef.current
      if (e.ctrlKey || e.metaKey) {
        const step = ZOOM_STEP * zoomStepMulRef.current
        if (!scroll) {
          const direction = e.deltaY > 0 ? -1 : 1
          applyZoomAtDocAnchor(zoomRef.current + direction * step)
          return
        }
        const rect = scroll.getBoundingClientRect()
        const localX = e.clientX - rect.left
        const localY = e.clientY - rect.top
        const direction = e.deltaY > 0 ? -1 : 1
        applyZoomAtScreen(zoomRef.current + direction * step, localX, localY)
        return
      }
      if (scroll) {
        scroll.scrollLeft += e.deltaX
        scroll.scrollTop += e.deltaY
      }
    },
    [applyZoomAtDocAnchor, applyZoomAtScreen, scrollRef]
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const scroll = scrollRef.current
      if (!scroll) return

      activePointers.current.set(e.pointerId, {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        clientX: e.clientX,
        clientY: e.clientY,
      })

      const isMouseLikePan =
        e.pointerType === 'mouse' &&
        (e.button === 1 || (e.button === 0 && spaceHeldRef.current))
      const tool = getToolModeRef.current?.()
      const isSingleTouchHandPan =
        tool === 'hand' &&
        (e.pointerType === 'touch' || e.pointerType === 'pen') &&
        activePointers.current.size === 1
      if (isMouseLikePan || isSingleTouchHandPan) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // setPointerCapture can throw on synthesized pointers in
          // tests; ignore — we still get pointermove via bubbling.
        }
        panRef.current = {
          pointerId: e.pointerId,
          startClientX: e.clientX,
          startClientY: e.clientY,
          scrollLeft: scroll.scrollLeft,
          scrollTop: scroll.scrollTop,
        }
        setIsPanning(true)
        setPanActive(true)
        return
      }

      // Two-finger pinch-zoom on touch / pen.
      if (
        (e.pointerType === 'touch' || e.pointerType === 'pen') &&
        activePointers.current.size === 2
      ) {
        const [a, b] = Array.from(activePointers.current.values()) as [
          ActivePointer,
          ActivePointer,
        ]
        pinchRef.current = {
          pointerIds: [a.pointerId, b.pointerId],
          startDistance: distance(a, b) || 1,
          startZoom: zoomRef.current,
        }
        setPanActive(true)
      }
    },
    [scrollRef]
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const scroll = scrollRef.current
      if (!scroll) return

      const tracked = activePointers.current.get(e.pointerId)
      if (tracked) {
        tracked.clientX = e.clientX
        tracked.clientY = e.clientY
      }

      const pan = panRef.current
      if (pan && pan.pointerId === e.pointerId) {
        const dx = e.clientX - pan.startClientX
        const dy = e.clientY - pan.startClientY
        scroll.scrollLeft = pan.scrollLeft - dx
        scroll.scrollTop = pan.scrollTop - dy
        return
      }

      const pinch = pinchRef.current
      if (
        pinch &&
        (pinch.pointerIds[0] === e.pointerId ||
          pinch.pointerIds[1] === e.pointerId)
      ) {
        const a = activePointers.current.get(pinch.pointerIds[0])
        const b = activePointers.current.get(pinch.pointerIds[1])
        if (!a || !b) return
        const ratio = distance(a, b) / pinch.startDistance
        const targetZoom = pinch.startZoom * ratio
        const rect = scroll.getBoundingClientRect()
        const midClientX = (a.clientX + b.clientX) / 2
        const midClientY = (a.clientY + b.clientY) / 2
        applyZoomAtScreen(
          targetZoom,
          midClientX - rect.left,
          midClientY - rect.top
        )
      }
    },
    [applyZoomAtScreen, scrollRef]
  )

  const releasePointer = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      activePointers.current.delete(e.pointerId)

      const pan = panRef.current
      if (pan && pan.pointerId === e.pointerId) {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
        panRef.current = null
        setIsPanning(false)
        setPanActive(false)
      }

      const pinch = pinchRef.current
      if (
        pinch &&
        (pinch.pointerIds[0] === e.pointerId ||
          pinch.pointerIds[1] === e.pointerId)
      ) {
        pinchRef.current = null
        setPanActive(false)
      }
    },
    []
  )

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' && !spaceHeldRef.current) {
      spaceHeldRef.current = true
      e.preventDefault()
    }
  }, [])

  const onKeyUp = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') {
      spaceHeldRef.current = false
    }
  }, [])

  useEffect(
    () => () => {
      activePointers.current.clear()
      panRef.current = null
      pinchRef.current = null
    },
    []
  )

  /** Recover if a pan/pinch ends outside the scroll container (lost pointer). */
  useEffect(() => {
    const releaseStaleGestures = () => {
      const pan = panRef.current
      if (pan && !activePointers.current.has(pan.pointerId)) {
        panRef.current = null
        setIsPanning(false)
        setPanActive(false)
      }
      const pinch = pinchRef.current
      if (pinch) {
        const [a, b] = pinch.pointerIds
        if (
          !activePointers.current.has(a) ||
          !activePointers.current.has(b)
        ) {
          pinchRef.current = null
          setPanActive(false)
        }
      }
    }
    window.addEventListener('pointerup', releaseStaleGestures)
    window.addEventListener('pointercancel', releaseStaleGestures)
    window.addEventListener('blur', releaseStaleGestures)
    return () => {
      window.removeEventListener('pointerup', releaseStaleGestures)
      window.removeEventListener('pointercancel', releaseStaleGestures)
      window.removeEventListener('blur', releaseStaleGestures)
    }
  }, [])

  /** Block Safari gesture zoom on the canvas viewport (passive: false). */
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const blockGesture = (ev: Event) => {
      ev.preventDefault()
    }
    scroll.addEventListener('gesturestart', blockGesture, { passive: false })
    scroll.addEventListener('gesturechange', blockGesture, { passive: false })
    scroll.addEventListener('gestureend', blockGesture, { passive: false })
    return () => {
      scroll.removeEventListener('gesturestart', blockGesture)
      scroll.removeEventListener('gesturechange', blockGesture)
      scroll.removeEventListener('gestureend', blockGesture)
    }
  }, [scrollRef, zoom])

  return {
    zoom,
    isPanning,
    panActive,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    resetViewport,
    centerView,
    fitToBounds,
    fitToBoundsStepped,
    scrollHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: releasePointer,
      onPointerCancel: releasePointer,
      onWheel,
      onKeyDown,
      onKeyUp,
    },
  }
}
