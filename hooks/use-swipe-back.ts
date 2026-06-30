'use client'

import { useEffect, useRef } from 'react'
import { useMobileViewport } from '@/hooks/use-mobile-viewport'
import {
  readSafeAreaInsetLeft,
  readSafeAreaInsetRight,
  shouldCancelSwipeBack,
  shouldCompleteSwipeBack,
  shouldCompleteSwipeForward,
  shouldStartSwipeBack,
  shouldStartSwipeForward,
  swipeBackEdgeZonePx,
  swipeForwardEdgeZonePx,
} from '@/lib/navigation/swipe-back-gesture'

type SwipeDirection = 'back' | 'forward'

interface UseSwipeBackOptions {
  enabledBack: boolean
  onSwipeBack: () => void
  enabledForward: boolean
  onSwipeForward: () => void
}

export function useSwipeBack({
  enabledBack,
  onSwipeBack,
  enabledForward,
  onSwipeForward,
}: UseSwipeBackOptions) {
  const isMobile = useMobileViewport()
  const onSwipeBackRef = useRef(onSwipeBack)
  const onSwipeForwardRef = useRef(onSwipeForward)
  onSwipeBackRef.current = onSwipeBack
  onSwipeForwardRef.current = onSwipeForward

  const activeRef = useRef(false)
  const directionRef = useRef<SwipeDirection | null>(null)
  const startRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if ((!enabledBack && !enabledForward) || !isMobile) return

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return

      const touch = event.touches[0]
      if (shouldCancelSwipeBack(event.target)) return

      const viewportWidth = window.innerWidth
      const backEdgeZone = swipeBackEdgeZonePx(readSafeAreaInsetLeft())
      const forwardEdgeZone = swipeForwardEdgeZonePx(readSafeAreaInsetRight())

      let direction: SwipeDirection | null = null
      if (enabledBack && shouldStartSwipeBack(touch, backEdgeZone)) {
        direction = 'back'
      } else if (
        enabledForward &&
        shouldStartSwipeForward(touch, forwardEdgeZone, viewportWidth)
      ) {
        direction = 'forward'
      }
      if (!direction) return

      activeRef.current = true
      directionRef.current = direction
      startRef.current = { x: touch.clientX, y: touch.clientY }
    }

    function onTouchMove(event: TouchEvent) {
      if (!activeRef.current || event.touches.length !== 1) return

      const touch = event.touches[0]
      const deltaX = touch.clientX - startRef.current.x
      const deltaY = touch.clientY - startRef.current.y

      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 12) {
        activeRef.current = false
        directionRef.current = null
        return
      }

      const direction = directionRef.current
      if (direction === 'back' && deltaX > 8) {
        event.preventDefault()
      } else if (direction === 'forward' && deltaX < -8) {
        event.preventDefault()
      }
    }

    function onTouchEnd(event: TouchEvent) {
      if (!activeRef.current) return

      const touch = event.changedTouches[0]
      const deltaX = touch.clientX - startRef.current.x
      const deltaY = touch.clientY - startRef.current.y
      const direction = directionRef.current

      activeRef.current = false
      directionRef.current = null

      if (direction === 'back' && shouldCompleteSwipeBack(deltaX, deltaY)) {
        onSwipeBackRef.current()
      } else if (direction === 'forward' && shouldCompleteSwipeForward(deltaX, deltaY)) {
        onSwipeForwardRef.current()
      }
    }

    function onTouchCancel() {
      activeRef.current = false
      directionRef.current = null
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
  }, [enabledBack, enabledForward, isMobile])
}
