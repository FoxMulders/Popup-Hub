'use client'

import { useLayoutEffect, type ReactNode } from 'react'
import { useDashboardWorkspaceView } from './dashboard-workspace-view-context'

const FOCUS_CLASS = 'hub-grid-focus-mode'

/** Syncs blueprint focus chrome — hides global AppNav, enables slim nav rail layout. */
export function HubGridChromeModeSync() {
  const { isBlueprint } = useDashboardWorkspaceView()

  useLayoutEffect(() => {
    if (isBlueprint) {
      document.documentElement.classList.add(FOCUS_CLASS)
    } else {
      document.documentElement.classList.remove(FOCUS_CLASS)
    }
    return () => document.documentElement.classList.remove(FOCUS_CLASS)
  }, [isBlueprint])

  return null
}

export function HubGridChromeModeProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <HubGridChromeModeSync />
      {children}
    </>
  )
}
