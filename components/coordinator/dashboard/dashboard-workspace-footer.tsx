'use client'

import { DashboardNextStepCta } from './dashboard-next-step-cta'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'

/**
 * Shared workflow footer for Blueprint Studio and Allocation Ledger views.
 */
export function DashboardWorkspaceFooter() {
  const { previewMode } = useCommandCenterFullscreen()

  if (previewMode) return null

  return (
    <footer className="dashboard-workspace-footer shrink-0 border-t border-stone-200/90 bg-stone-50/80 p-1.5">
      <DashboardNextStepCta inline className="max-w-none" />
    </footer>
  )
}
