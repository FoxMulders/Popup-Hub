'use client'

import {
  createContext,
  useCallback,
  useContext,
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
  /** True when the top horizontal toolbar strip is mounted. */
  topBarActive: boolean
}

const DashboardToolbarPortalContext =
  createContext<DashboardToolbarPortalContextValue | null>(null)

export function DashboardToolbarPortalProvider({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<HTMLElement | null>(null)

  const setTarget = useCallback((node: HTMLElement | null) => {
    setTargetState(node)
  }, [])

  const topBarActive = Boolean(target)

  const value = useMemo(
    () => ({ target, setTarget, topBarActive }),
    [target, setTarget, topBarActive]
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

/** Mount point for the floor-plan command ribbon in the top toolbar strip. */
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
        'dashboard-toolbar-portal flex min-h-0 min-w-0 flex-1 empty:hidden',
        className
      )}
      aria-label="Layout tools"
    />
  )
}
