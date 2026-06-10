'use client'

import { BoothMatrixPanel } from './booth-matrix-panel'
import { DashboardNextStepCta } from './dashboard-next-step-cta'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'

/**
 * Page 2 — Allocation Ledger: full-width booth matrix for financial and assignment auditing.
 */
export function DashboardAllocationLedger() {
  const { previewMode } = useCommandCenterFullscreen()

  return (
    <div className="dashboard-allocation-ledger flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <BoothMatrixPanel variant="ledger" defaultOpen />
      </div>
      {!previewMode ? (
        <footer className="dashboard-allocation-ledger__footer shrink-0 border-t border-stone-200/90 bg-stone-50/80 p-1.5">
          <DashboardNextStepCta inline className="max-w-none" />
        </footer>
      ) : null}
    </div>
  )
}
