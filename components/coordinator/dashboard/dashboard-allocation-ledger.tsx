'use client'

import { BoothMatrixPanel } from './booth-matrix-panel'
import { DashboardLedgerViewportGuard } from './dashboard-ledger-viewport-guard'

/**
 * Page 2 — Allocation Ledger: full-width booth matrix for financial and assignment auditing.
 */
export function DashboardAllocationLedger() {
  return (
    <div className="dashboard-allocation-ledger flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <DashboardLedgerViewportGuard className="h-full">
          <BoothMatrixPanel variant="ledger" defaultOpen />
        </DashboardLedgerViewportGuard>
      </div>
    </div>
  )
}
