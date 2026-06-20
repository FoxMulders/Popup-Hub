'use client'

import { DashboardNextStepCta } from './dashboard-next-step-cta'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { useDashboardWorkspaceView } from './dashboard-workspace-view-context'
import { useMarketManagement } from './market-management-context'

/**
 * Minimal workflow footer for Allocation Ledger — HubGrid canvas uses header tabs instead.
 */
export function DashboardWorkspaceFooter() {
  const { previewMode } = useCommandCenterFullscreen()
  const { isBlueprint } = useDashboardWorkspaceView()
  const { selectedEventId } = useMarketManagement()

  if (previewMode || isBlueprint || !selectedEventId) return null

  return (
    <footer className="dashboard-workspace-footer shrink-0 border-t border-stone-200/50 py-1">
      <DashboardNextStepCta inline className="max-w-none" />
    </footer>
  )
}
