'use client'

import { useCallback, useEffect, type RefObject } from 'react'

export const CANVAS_FULLSCREEN_CLASS = 'popup-hub-canvas-fullscreen'

export interface UseNativeFullscreenOptions {
  active: boolean
  onActiveChange: (active: boolean) => void
  targetRef?: RefObject<HTMLElement | null>
}

export function useNativeFullscreen({
  active,
  onActiveChange,
  targetRef,
}: UseNativeFullscreenOptions): {
  enter: () => Promise<void>
  exit: () => Promise<void>
} {
  const enter = useCallback(async () => {
    const el = targetRef?.current ?? document.documentElement
    document.documentElement.classList.add(CANVAS_FULLSCREEN_CLASS)
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen()
      }
    } catch {
      // CSS-only fullscreen fallback when API blocked
    }
    onActiveChange(true)
  }, [onActiveChange, targetRef])

  const exit = useCallback(async () => {
    document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      // ignore
    }
    onActiveChange(false)
  }, [onActiveChange])

  useEffect(() => {
    if (active) {
      document.documentElement.classList.add(CANVAS_FULLSCREEN_CLASS)
      void enter()
      return
    }
    document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    }
    // Do not call `exit()` here — it would invoke onActiveChange(false) on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
        onActiveChange(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [onActiveChange])

  return { enter, exit }
}
