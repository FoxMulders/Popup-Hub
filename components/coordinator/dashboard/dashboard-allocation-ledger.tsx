'use client'

import { FloorPlanMatrixSmallScreenWarning } from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'
import { BoothMatrixPanel } from './booth-matrix-panel'

/**
 * Page 2 — Allocation Ledger: full-width booth matrix for financial and assignment auditing.
 */
export function DashboardAllocationLedger() {
  return (
    <div className="dashboard-allocation-ledger flex min-h-0 flex-1 flex-col overflow-hidden">
      <FloorPlanMatrixSmallScreenWarning className="mx-3 mt-3 shrink-0" />
      <div className="min-h-0 flex-1 overflow-hidden">
        <BoothMatrixPanel variant="ledger" defaultOpen />
      </div>
    </div>
  )
}
