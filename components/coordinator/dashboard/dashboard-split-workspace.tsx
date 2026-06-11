'use client'

export interface DashboardSplitWorkspaceProps {
  /** Blueprint Studio — floor plan canvas column */
  blueprint: React.ReactNode
}

/**
 * Blueprint Studio workspace shell. Legend and allocation ledger live as
 * matching canvas side rails inside the floor plan viewport.
 */
export function DashboardSplitWorkspace({ blueprint }: DashboardSplitWorkspaceProps) {
  return (
    <section
      className="dashboard-split-workspace flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      aria-label="Blueprint Studio"
    >
      {blueprint}
    </section>
  )
}
