'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CANVAS_FULLSCREEN_CLASS } from '@/components/coordinator/floor-plan-v2/canvas/use-native-fullscreen'

const DASHBOARD_ROOT_ID = 'coordinator-dashboard-root'

interface CommandCenterFullscreenContextValue {
  fullscreen: boolean
  setFullscreen: (value: boolean) => void
  toggleFullscreen: () => void
  previewMode: boolean
  setPreviewMode: (value: boolean) => void
  togglePreviewMode: () => void
}

const CommandCenterFullscreenContext =
  createContext<CommandCenterFullscreenContextValue | null>(null)

function dashboardFullscreenTarget(): HTMLElement | null {
  return document.getElementById(DASHBOARD_ROOT_ID)
}

export function CommandCenterFullscreenProvider({ children }: { children: ReactNode }) {
  const [fullscreen, setFullscreenState] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  useLayoutEffect(() => {
    document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
    document.body.dataset.dashboardCommandCenter = 'true'
    return () => {
      delete document.body.dataset.dashboardCommandCenter
      document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  const setFullscreen = useCallback(async (value: boolean) => {
    const root = dashboardFullscreenTarget() ?? document.documentElement
    if (value) {
      document.documentElement.classList.add(CANVAS_FULLSCREEN_CLASS)
      try {
        if (!document.fullscreenElement) {
          await root.requestFullscreen()
        }
      } catch {
        // CSS-only fallback when Fullscreen API is blocked
      }
      setFullscreenState(true)
      return
    }

    document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      // ignore
    }
    setFullscreenState(false)
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
        setFullscreenState(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    void setFullscreen(!fullscreen)
  }, [fullscreen, setFullscreen])

  const togglePreviewMode = useCallback(() => {
    setPreviewMode((v) => !v)
  }, [])

  const value = useMemo(
    () => ({
      fullscreen,
      setFullscreen,
      toggleFullscreen,
      previewMode,
      setPreviewMode,
      togglePreviewMode,
    }),
    [fullscreen, setFullscreen, toggleFullscreen, previewMode, togglePreviewMode]
  )

  return (
    <CommandCenterFullscreenContext.Provider value={value}>
      {children}
    </CommandCenterFullscreenContext.Provider>
  )
}

/** Dashboard command-center native browser fullscreen. */
export function useCommandCenterFullscreen(): CommandCenterFullscreenContextValue {
  const ctx = useContext(CommandCenterFullscreenContext)
  if (!ctx) {
    return {
      fullscreen: false,
      setFullscreen: () => {},
      toggleFullscreen: () => {},
      previewMode: false,
      setPreviewMode: () => {},
      togglePreviewMode: () => {},
    }
  }
  return ctx
}
