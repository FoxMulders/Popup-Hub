'use client'

import { DashboardLedgerViewportGuard } from './dashboard-ledger-viewport-guard'
import { BoothMatrixPanel } from './booth-matrix-panel'

/**
 * Page 2 — Allocation Ledger: full-width booth matrix for financial and assignment auditing.
 */
export function DashboardAllocationLedger() {
  return (
    <DashboardLedgerViewportGuard className="dashboard-allocation-ledger flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <BoothMatrixPanel variant="ledger" defaultOpen />
      </div>
    </DashboardLedgerViewportGuard>
  )
}
