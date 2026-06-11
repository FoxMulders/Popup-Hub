'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BoothMatrixPanel } from './booth-matrix-panel'
import { useDashboardWorkspaceView } from './dashboard-workspace-view-context'
import { cn } from '@/lib/utils'

export interface DashboardSplitWorkspaceProps {
  /** Blueprint Studio — floor plan canvas column */
  blueprint: React.ReactNode
}

/**
 * Virtual split-pane: Blueprint Studio (~65%) + Allocation Ledger (~35%).
 * Right pane collapses smoothly so the canvas can fill the workspace width.
 */
export function DashboardSplitWorkspace({ blueprint }: DashboardSplitWorkspaceProps) {
  const { ledgerPaneCollapsed, toggleLedgerPane } = useDashboardWorkspaceView()

  return (
    <div
      className={cn(
        'dashboard-split-workspace flex min-h-0 min-w-0 flex-1 overflow-hidden',
        ledgerPaneCollapsed && 'dashboard-split-workspace--ledger-collapsed'
      )}
    >
      <section
        className="dashboard-split-workspace__blueprint relative flex min-h-0 min-w-0 flex-col overflow-hidden"
        aria-label="Blueprint Studio"
      >
        {blueprint}
      </section>

      {ledgerPaneCollapsed ? (
        <button
          type="button"
          className="dashboard-split-workspace__expand-rail"
          aria-label="Show Allocation Ledger"
          title="Show Allocation Ledger"
          onClick={toggleLedgerPane}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span className="dashboard-split-workspace__expand-rail-label">Ledger</span>
        </button>
      ) : (
        <aside
          className="dashboard-split-workspace__ledger flex min-h-0 min-w-0 flex-col overflow-hidden"
          aria-label="Allocation Ledger"
        >
          <header className="dashboard-split-workspace__ledger-header shrink-0">
            <div className="min-w-0">
              <h2 className="truncate text-[11px] font-bold uppercase tracking-wide text-stone-800">
                Allocation Ledger
              </h2>
              <p className="text-[10px] text-stone-500">Booth matrix</p>
            </div>
            <button
              type="button"
              className="dashboard-split-workspace__collapse-btn"
              aria-label="Collapse Allocation Ledger"
              title="Collapse Allocation Ledger"
              onClick={toggleLedgerPane}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </header>

          <div className="dashboard-split-workspace__ledger-body min-h-0 flex-1 overflow-hidden">
            <BoothMatrixPanel variant="split" defaultOpen />
          </div>
        </aside>
      )}
    </div>
  )
}
