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
  headerTarget: HTMLElement | null
  setHeaderTarget: (node: HTMLElement | null) => void
  /** True when the header room/canvas toolbar host is mounted. */
  headerBarActive: boolean
}

const DashboardToolbarPortalContext =
  createContext<DashboardToolbarPortalContextValue | null>(null)

export function DashboardToolbarPortalProvider({ children }: { children: ReactNode }) {
  const [target, setTargetState] = useState<HTMLElement | null>(null)
  const [headerTarget, setHeaderTargetState] = useState<HTMLElement | null>(null)

  const setTarget = useCallback((node: HTMLElement | null) => {
    setTargetState(node)
  }, [])

  const setHeaderTarget = useCallback((node: HTMLElement | null) => {
    setHeaderTargetState(node)
  }, [])

  const topBarActive = Boolean(target)
  const headerBarActive = Boolean(headerTarget)

  const value = useMemo(
    () => ({
      target,
      setTarget,
      topBarActive,
      headerTarget,
      setHeaderTarget,
      headerBarActive,
    }),
    [target, setTarget, topBarActive, headerTarget, setHeaderTarget, headerBarActive]
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

/** Mount point for room/canvas controls in the HubGrid header row. */
export function DashboardHeaderToolbarPortalTarget({ className }: { className?: string }) {
  const setHeaderTarget = useDashboardToolbarPortal()?.setHeaderTarget
  const hostRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!setHeaderTarget) return
    const node = hostRef.current
    setHeaderTarget(node)
    return () => setHeaderTarget(null)
  }, [setHeaderTarget])

  return (
    <div
      ref={hostRef}
      className={cn(
        'dashboard-header-toolbar-portal flex min-h-0 min-w-0 flex-1 empty:hidden',
        className
      )}
      aria-label="Room and canvas controls"
    />
  )
}
