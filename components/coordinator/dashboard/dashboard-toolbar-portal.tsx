'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import {
  isPocketSizedViewport,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
} from '@/hooks/use-floor-plan-viewport-tier'

interface DashboardToolbarPortalContextValue {
  target: HTMLElement | null
  setTarget: (node: HTMLElement | null) => void
  /** True at lg+ when the left rail is visible (toolbar belongs in sidebar). */
  sidebarActive: boolean
}

const DashboardToolbarPortalContext =
  createContext<DashboardToolbarPortalContextValue | null>(null)

const LG_MIN_QUERY = `(min-width: ${FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px)`

export function DashboardToolbarPortalProvider({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<HTMLElement | null>(null)
  const [sidebarActive, setSidebarActive] = useState(false)

  const setTarget = useCallback((node: HTMLElement | null) => {
    setTargetState(node)
  }, [])

  useEffect(() => {
    const mqDesktop = window.matchMedia(`(min-width: ${FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px)`)
    const sync = () => {
      const pocketSized = isPocketSizedViewport(
        window.innerWidth,
        window.innerHeight
      )
      setSidebarActive(!pocketSized && mqDesktop.matches)
    }
    sync()
    mqDesktop.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      mqDesktop.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  const value = useMemo(
    () => ({ target, setTarget, sidebarActive }),
    [target, setTarget, sidebarActive]
  )

  return (
    <DashboardToolbarPortalContext.Provider value={value}>
      {children}
    </DashboardToolbarPortalContext.Provider>
  )
}

export function useDashboardToolbarPortal() {
  return useContext(DashboardToolbarPortalContext)
}

/** Mount point for the floor-plan command ribbon in the left curation column. */
export function DashboardToolbarPortalTarget({ className }: { className?: string }) {
  const setTarget = useDashboardToolbarPortal()?.setTarget
  const hostRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!setTarget) return
    const node = hostRef.current
    setTarget(node)
    return () => setTarget(null)
  }, [setTarget])

  return (
    <div
      ref={hostRef}
      className={cn(
        'dashboard-toolbar-portal flex min-h-0 w-[300px] min-w-[300px] flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain border-b border-stone-200/80 bg-card/60 px-2 py-2 empty:hidden [-webkit-overflow-scrolling:touch]',
        className
      )}
      aria-label="Layout tools"
    />
  )
}
