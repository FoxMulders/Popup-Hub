'use client'

import { useEffect, useRef } from 'react'
import { useMobileViewport } from '@/hooks/use-mobile-viewport'
import {
  readSafeAreaInsetLeft,
  shouldCancelSwipeBack,
  shouldCompleteSwipeBack,
  shouldStartSwipeBack,
  swipeBackEdgeZonePx,
} from '@/lib/navigation/swipe-back-gesture'

interface UseSwipeBackOptions {
  enabled: boolean
  onSwipeBack: () => void
}

export function useSwipeBack({ enabled, onSwipeBack }: UseSwipeBackOptions) {
  const isMobile = useMobileViewport()
  const onSwipeBackRef = useRef(onSwipeBack)
  onSwipeBackRef.current = onSwipeBack

  const activeRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })
  const trackingRef = useRef(false)

  useEffect(() => {
    if (!enabled || !isMobile) return

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return

      const touch = event.touches[0]
      if (shouldCancelSwipeBack(event.target)) return

      const edgeZone = swipeBackEdgeZonePx(readSafeAreaInsetLeft())
      if (!shouldStartSwipeBack(touch, edgeZone)) return

      activeRef.current = true
      trackingRef.current = true
      startRef.current = { x: touch.clientX, y: touch.clientY }
    }

    function onTouchMove(event: TouchEvent) {
      if (!activeRef.current || event.touches.length !== 1) return

      const touch = event.touches[0]
      const deltaX = touch.clientX - startRef.current.x
      const deltaY = touch.clientY - startRef.current.y

      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 12) {
        activeRef.current = false
        trackingRef.current = false
        return
      }

      if (deltaX > 8) {
        event.preventDefault()
      }
    }

    function onTouchEnd(event: TouchEvent) {
      if (!activeRef.current) return

      const touch = event.changedTouches[0]
      const deltaX = touch.clientX - startRef.current.x
      const deltaY = touch.clientY - startRef.current.y

      activeRef.current = false
      trackingRef.current = false

      if (shouldCompleteSwipeBack(deltaX, deltaY)) {
        onSwipeBackRef.current()
      }
    }

    function onTouchCancel() {
      activeRef.current = false
      trackingRef.current = false
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [enabled, isMobile])
}
