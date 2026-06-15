import { Suspense } from 'react'
import { DashboardLedgerWindowClient } from '@/components/coordinator/dashboard/dashboard-ledger-window-client'

export const metadata = {
  title: 'Booth Matrix — Dual-Screen — Popup Hub',
}

export default function CoordinatorStudioLedgerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-stone-600">
          Loading booth matrix…
        </div>
      }
    >
      <div className="h-screen min-h-0 overflow-hidden">
        <DashboardLedgerWindowClient />
      </div>
    </Suspense>
  )
}
