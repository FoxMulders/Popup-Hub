'use client'

export interface DashboardSplitWorkspaceProps {
  /** HubGrid — floor plan canvas column */
  blueprint: React.ReactNode
}

/**
 * HubGrid workspace shell. Legend and allocation ledger live as
 * matching canvas side rails inside the floor plan viewport.
 */
export function DashboardSplitWorkspace({ blueprint }: DashboardSplitWorkspaceProps) {
  return (
    <section
      className="dashboard-split-workspace flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      aria-label="HubGrid"
    >
      {blueprint}
    </section>
  )
}
