'use client'

import { DashboardToolbarPortalTarget } from './dashboard-toolbar-portal'

/**
 * Left utility rail — layout tool accordions only (no curation queue).
 */
export function DashboardLeftPanel() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col justify-start overflow-hidden bg-white">
      <DashboardToolbarPortalTarget className="min-h-0 flex-1 overflow-y-auto border-b-0 px-1 py-1" />
    </div>
  )
}
