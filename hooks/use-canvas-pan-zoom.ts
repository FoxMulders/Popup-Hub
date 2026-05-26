'use client'

import { useCallback, useRef, useState, type RefObject } from 'react'
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

export function useCanvasPanZoom({ scrollRef, initialZoom = LAYOUT_ZOOM_DEFAULT }: UseCanvasPanZoomOptions) {
  const [zoom, setZoom] = useState(initialZoom)
  const [isPanning, setIsPanning] = useState(false)
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(
    null
  )
  const spaceHeldRef = useRef(false)

  const onZoomChange = useCallback((next: number) => {
    setZoom(clampZoom(next))
  }, [])

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLElement>) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const delta = event.deltaY > 0 ? -LAYOUT_ZOOM_STEP : LAYOUT_ZOOM_STEP
      setZoom((z) => clampZoom(z + delta))
    },
    []
  )

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const isPanButton = event.button === 1 || (event.button === 0 && spaceHeldRef.current)
    if (!isPanButton) return
    const el = scrollRef.current
    if (!el) return
    event.preventDefault()
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    }
    setIsPanning(true)
    el.setPointerCapture(event.pointerId)
  }, [scrollRef])

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const pan = panRef.current
      const el = scrollRef.current
      if (!pan || !el || pan.pointerId !== event.pointerId) return
      el.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX)
      el.scrollTop = pan.scrollTop - (event.clientY - pan.startY)
    },
    [scrollRef]
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const pan = panRef.current
      const el = scrollRef.current
      if (!pan || pan.pointerId !== event.pointerId) return
      panRef.current = null
      setIsPanning(false)
      el?.releasePointerCapture(event.pointerId)
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
    },
    isPanning,
  }
}
