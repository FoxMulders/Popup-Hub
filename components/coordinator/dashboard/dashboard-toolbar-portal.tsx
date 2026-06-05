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

export function DashboardToolbarPortalProvider({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<HTMLElement | null>(null)
  const [sidebarActive, setSidebarActive] = useState(false)

  const setTarget = useCallback((node: HTMLElement | null) => {
    setTargetState(node)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia(LG_MIN_QUERY)
    const sync = () => setSidebarActive(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
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
        'dashboard-toolbar-portal shrink-0 border-b border-stone-200/80 bg-card/60 px-2 py-2 empty:hidden',
        className
      )}
      aria-label="Layout tools"
    />
  )
}
