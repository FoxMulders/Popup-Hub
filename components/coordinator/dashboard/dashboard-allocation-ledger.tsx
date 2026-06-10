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
      <BoothMatrixPanel
        variant="ledger"
        defaultOpen
        headerAction={
          !previewMode ? (
            <DashboardNextStepCta inline className="max-w-[16rem]" />
          ) : undefined
        }
      />
    </div>
  )
}
