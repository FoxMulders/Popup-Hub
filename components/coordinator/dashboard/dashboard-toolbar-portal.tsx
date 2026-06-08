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

interface DashboardToolbarPortalContextValue {
  target: HTMLElement | null
  setTarget: (node: HTMLElement | null) => void
  /** True at lg+ when the left rail is visible (toolbar belongs in sidebar). */
  sidebarActive: boolean
}

const DashboardToolbarPortalContext =
  createContext<DashboardToolbarPortalContextValue | null>(null)

const LG_MIN_QUERY = '(min-width: 1024px)'
const TABLET_MIN_QUERY = '(min-width: 768px)'
const TABLET_MAX_QUERY = '(max-width: 1023px)'

export function DashboardToolbarPortalProvider({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<HTMLElement | null>(null)
  const [sidebarActive, setSidebarActive] = useState(false)

  const setTarget = useCallback((node: HTMLElement | null) => {
    setTargetState(node)
  }, [])

  useEffect(() => {
    const mqDesktop = window.matchMedia(LG_MIN_QUERY)
    const mqTabletMin = window.matchMedia(TABLET_MIN_QUERY)
    const mqTabletMax = window.matchMedia(TABLET_MAX_QUERY)
    const sync = () => {
      const isTablet =
        mqTabletMin.matches && mqTabletMax.matches
      setSidebarActive(mqDesktop.matches || isTablet)
    }
    sync()
    mqDesktop.addEventListener('change', sync)
    mqTabletMin.addEventListener('change', sync)
    mqTabletMax.addEventListener('change', sync)
    return () => {
      mqDesktop.removeEventListener('change', sync)
      mqTabletMin.removeEventListener('change', sync)
      mqTabletMax.removeEventListener('change', sync)
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
        'dashboard-toolbar-portal flex w-[300px] min-w-[300px] flex-shrink-0 flex-col gap-4 overflow-y-auto border-b border-stone-200/80 bg-card/60 px-2 py-2 empty:hidden',
        className
      )}
      aria-label="Layout tools"
    />
  )
}
