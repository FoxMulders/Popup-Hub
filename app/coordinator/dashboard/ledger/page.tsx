import { Suspense } from 'react'
import { DashboardLedgerWindowClient } from '@/components/coordinator/dashboard/dashboard-ledger-window-client'
import { FloorPlanDesktopRequiredBoundary } from '@/components/coordinator/floor-plan-v2/canvas/floor-plan-viewport-advisory'

export const metadata = {
  title: 'Booth Matrix — Dual-Screen — Popup Hub',
}

export default function CoordinatorDashboardLedgerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-stone-600">
          Loading booth matrix…
        </div>
      }
    >
      <div className="h-screen min-h-0 overflow-hidden">
        <FloorPlanDesktopRequiredBoundary
          exitHref="/coordinator/dashboard"
          placeholderClassName="h-screen"
        >
          <DashboardLedgerWindowClient />
        </FloorPlanDesktopRequiredBoundary>
      </div>
    </Suspense>
  )
}
