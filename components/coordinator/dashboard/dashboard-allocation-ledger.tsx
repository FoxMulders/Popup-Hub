'use client'

import { BoothMatrixPanel } from './booth-matrix-panel'

/**
 * Page 2 — Allocation Ledger: full-width booth matrix for financial and assignment auditing.
 */
export function DashboardAllocationLedger() {
  return (
    <div className="dashboard-allocation-ledger flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <BoothMatrixPanel variant="ledger" defaultOpen />
      </div>
    </div>
  )
}
