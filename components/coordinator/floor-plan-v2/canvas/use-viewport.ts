'use client'

import {
  useCallback,
  useEffect,
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

export interface ViewportApi extends ViewportState {
  setZoom: (next: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  /**
   * Handlers to attach to the scroll container. Manages middle-mouse +
   * spacebar pan, wheel zoom (with Ctrl/Cmd), and two-finger pinch zoom
   * for touch devices.
   */
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

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

function distance(a: ActivePointer, b: ActivePointer): number {
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

export function useViewport(
  scrollRef: RefObject<HTMLDivElement | null>,
  initialZoom = 1
): ViewportApi {
  const [zoom, setZoomState] = useState(initialZoom)
  const [isPanning, setIsPanning] = useState(false)
  const [panActive, setPanActive] = useState(false)

  // Mirror `zoom` into a ref so RAF / pointer-callback closures can
  // read the latest value without re-binding. Updated in an effect to
  // satisfy React's "don't write refs during render" rule.
  const zoomRef = useRef(initialZoom)
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const activePointers = useRef<Map<number, ActivePointer>>(new Map())
  const panRef = useRef<PanInternal | null>(null)
  const pinchRef = useRef<PinchInternal | null>(null)
  const spaceHeldRef = useRef(false)

  const setZoom = useCallback((next: number) => {
    setZoomState(clampZoom(next))
  }, [])

  const zoomIn = useCallback(() => setZoom(zoomRef.current + ZOOM_STEP * 4), [
    setZoom,
  ])
  const zoomOut = useCallback(
    () => setZoom(zoomRef.current - ZOOM_STEP * 4),
    [setZoom]
  )
  const resetZoom = useCallback(() => setZoom(1), [setZoom])

  const onWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const direction = e.deltaY > 0 ? -1 : 1
      setZoom(zoomRef.current + direction * ZOOM_STEP * 4)
    },
    [setZoom]
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
      if (isMouseLikePan) {
        e.currentTarget.setPointerCapture(e.pointerId)
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
        setZoom(pinch.startZoom * ratio)
      }
    },
    [scrollRef, setZoom]
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

  return {
    zoom,
    isPanning,
    panActive,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
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
