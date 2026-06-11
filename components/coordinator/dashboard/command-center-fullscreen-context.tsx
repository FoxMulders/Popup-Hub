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
const COMMAND_CENTER_FULLSCREEN_CLASS = 'command-center-canvas-fullscreen'
const DASHBOARD_PREVIEW_ATTR = 'data-dashboard-preview'

function applyDashboardFullscreenClasses(active: boolean) {
  if (active) {
    document.documentElement.classList.add(CANVAS_FULLSCREEN_CLASS)
    document.documentElement.classList.add(COMMAND_CENTER_FULLSCREEN_CLASS)
    return
  }
  document.documentElement.classList.remove(CANVAS_FULLSCREEN_CLASS)
  document.documentElement.classList.remove(COMMAND_CENTER_FULLSCREEN_CLASS)
}

function applyDashboardPreviewAttr(active: boolean) {
  if (active) {
    document.documentElement.setAttribute(DASHBOARD_PREVIEW_ATTR, 'true')
    return
  }
  document.documentElement.removeAttribute(DASHBOARD_PREVIEW_ATTR)
}

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
  const [previewMode, setPreviewModeState] = useState(false)

  useLayoutEffect(() => {
    applyDashboardFullscreenClasses(false)
    applyDashboardPreviewAttr(false)
    document.body.dataset.dashboardCommandCenter = 'true'
    return () => {
      delete document.body.dataset.dashboardCommandCenter
      applyDashboardFullscreenClasses(false)
      applyDashboardPreviewAttr(false)
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  const setFullscreen = useCallback(async (value: boolean) => {
    const root = dashboardFullscreenTarget() ?? document.documentElement
    if (value) {
      applyDashboardFullscreenClasses(true)
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

    applyDashboardFullscreenClasses(false)
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
        applyDashboardFullscreenClasses(false)
        setFullscreenState(false)
        setPreviewModeState(false)
        applyDashboardPreviewAttr(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    void setFullscreen(!fullscreen)
  }, [fullscreen, setFullscreen])

  const setPreviewMode = useCallback(
    (value: boolean) => {
      setPreviewModeState(value)
      applyDashboardPreviewAttr(value)
      void setFullscreen(value)
    },
    [setFullscreen]
  )

  const togglePreviewMode = useCallback(() => {
    setPreviewMode(!previewMode)
  }, [previewMode, setPreviewMode])

  const value = useMemo(
    () => ({
      fullscreen,
      setFullscreen,
      toggleFullscreen,
      previewMode,
      setPreviewMode,
      togglePreviewMode,
    }),
    [fullscreen, setFullscreen, toggleFullscreen, previewMode, setPreviewMode, togglePreviewMode]
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
