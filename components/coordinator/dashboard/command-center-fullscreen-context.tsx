'use client'

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CANVAS_FULLSCREEN_CLASS } from '@/components/coordinator/floor-plan-v2/canvas/use-native-fullscreen'

const HTML_CLASS = 'command-center-canvas-fullscreen'

interface CommandCenterFullscreenContextValue {
  fullscreen: boolean
  setFullscreen: (value: boolean) => void
  toggleFullscreen: () => void
}

const CommandCenterFullscreenContext =
  createContext<CommandCenterFullscreenContextValue | null>(null)

export function CommandCenterFullscreenProvider({ children }: { children: ReactNode }) {
  /** Panels visible by default so back / New market links stay reachable. */
  const [fullscreen, setFullscreen] = useState(false)

  useLayoutEffect(() => {
    document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
    document.body.dataset.dashboardCommandCenter = 'true'
    return () => {
      delete document.body.dataset.dashboardCommandCenter
      document.documentElement.classList.remove(HTML_CLASS)
      document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
    }
  }, [])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle(HTML_CLASS, fullscreen)
    return () => root.classList.remove(HTML_CLASS)
  }, [fullscreen])

  const toggleFullscreen = useCallback(() => {
    setFullscreen((v) => !v)
  }, [])

  const value = useMemo(
    () => ({ fullscreen, setFullscreen, toggleFullscreen }),
    [fullscreen, toggleFullscreen]
  )

  return (
    <CommandCenterFullscreenContext.Provider value={value}>
      {children}
    </CommandCenterFullscreenContext.Provider>
  )
}

/** Dashboard command-center canvas immersive mode (hides site + side chrome). */
export function useCommandCenterFullscreen(): CommandCenterFullscreenContextValue {
  const ctx = useContext(CommandCenterFullscreenContext)
  if (!ctx) {
    return {
      fullscreen: false,
      setFullscreen: () => {},
      toggleFullscreen: () => {},
    }
  }
  return ctx
}
