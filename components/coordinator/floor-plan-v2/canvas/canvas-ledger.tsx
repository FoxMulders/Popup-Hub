'use client'

import { BoothMatrixPanel } from '@/components/coordinator/dashboard/booth-matrix-panel'
import { useDashboardWorkspaceView } from '@/components/coordinator/dashboard/dashboard-workspace-view-context'
import { cn } from '@/lib/utils'
import { CanvasSideRail } from './canvas-side-rail'

export function CanvasLedger({ className }: { className?: string }) {
  const { ledgerPaneCollapsed, setLedgerPaneCollapsed } = useDashboardWorkspaceView()

  return (
    <CanvasSideRail
      side="right"
      collapsed={ledgerPaneCollapsed}
      onCollapsedChange={setLedgerPaneCollapsed}
      title="Ledger"
      ariaLabel="Allocation ledger"
      expandTitle="Show allocation ledger"
      collapseTitle="Hide allocation ledger"
      className={cn('canvas-ledger-panel', className)}
      panelClassName="shadow-[-4px_0_20px_rgb(28_25_23_/_0.1)]"
    >
      <BoothMatrixPanel variant="docked" defaultOpen />
    </CanvasSideRail>
  )
}
