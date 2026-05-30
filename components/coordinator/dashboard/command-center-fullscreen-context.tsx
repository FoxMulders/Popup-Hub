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

const HTML_CLASS = 'command-center-canvas-fullscreen'

interface CommandCenterFullscreenContextValue {
  fullscreen: boolean
  setFullscreen: (value: boolean) => void
  toggleFullscreen: () => void
}

const CommandCenterFullscreenContext =
  createContext<CommandCenterFullscreenContextValue | null>(null)

export function CommandCenterFullscreenProvider({ children }: { children: ReactNode }) {
  /** Blueprint-first: full-width canvas hides curation/telemetry chrome by default. */
  const [fullscreen, setFullscreen] = useState(true)

  useLayoutEffect(() => {
    document.body.dataset.dashboardCommandCenter = 'true'
    return () => {
      delete document.body.dataset.dashboardCommandCenter
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
