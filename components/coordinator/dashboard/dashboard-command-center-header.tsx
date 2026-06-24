'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { DashboardSavedLayoutToolbar } from './dashboard-saved-layout-toolbar'
import { HubGridHeaderSaveActions } from './hub-grid-header-save-actions'
import { useHubGridHeader } from './hub-grid-header-context'
import { HubGridMarketSelect } from './hub-grid-market-picker'
import { useDashboardWorkspaceView } from './dashboard-workspace-view-context'
import { useMarketManagement } from './market-management-context'

function statusLabel(status: string): string {
  if (status === 'draft') return 'Draft'
  if (status === 'published') return 'Published'
  if (status === 'active') return 'Active'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

function WorkspaceTabs() {
  const { view, setView, isBlueprint, isLedger } = useDashboardWorkspaceView()

  return (
    <nav
      className="dashboard-workspace-tabs flex shrink-0 items-center gap-1"
      aria-label="Floor plan workspace"
    >
      <button
        type="button"
        className={cn('dashboard-workspace-tab', isBlueprint && 'is-active')}
        aria-current={isBlueprint ? 'page' : undefined}
        onClick={() => setView('blueprint')}
      >
        HubGrid
      </button>
      <button
        type="button"
        className={cn('dashboard-workspace-tab', isLedger && 'is-active')}
        aria-current={isLedger ? 'page' : undefined}
        onClick={() => setView('ledger')}
      >
        Allocation Ledger
      </button>
      <span className="sr-only">Current view: {view}</span>
    </nav>
  )
}

function EditPreviewToggle() {
  const { previewMode, setPreviewMode } = useCommandCenterFullscreen()

  return (
    <button
      type="button"
      className="dashboard-pill-toggle"
      role="switch"
      aria-checked={previewMode}
      aria-label={previewMode ? 'Switch to edit mode' : 'Switch to preview mode'}
      onClick={() => setPreviewMode(!previewMode)}
    >
      <span className={cn('dashboard-pill-toggle__label', !previewMode && 'is-active')}>
        Edit
      </span>
      <span
        className={cn('dashboard-pill-toggle__track', previewMode && 'is-preview')}
      >
        <span className="dashboard-pill-toggle__thumb" />
      </span>
      <span className={cn('dashboard-pill-toggle__label', previewMode && 'is-active')}>
        Preview
      </span>
    </button>
  )
}

function BlueprintEventMeta() {
  const { selectedEventId, events } = useMarketManagement()
  const { placedCount } = useHubGridHeader()
  const selectedEvent = events.find((event) => event.id === selectedEventId)

  if (!selectedEventId || !selectedEvent) return null

  return (
    <div className="flex min-w-0 shrink items-center gap-2">
      <span className="truncate text-sm font-semibold text-stone-900">
        {selectedEvent.name}
      </span>
      <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-semibold uppercase">
        {statusLabel(selectedEvent.status)}
      </Badge>
      <span className="hidden shrink-0 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-stone-700 sm:inline">
        {placedCount} placed
      </span>
    </div>
  )
}

export function DashboardCommandCenterHeader({
  coordinatorId,
}: {
  coordinatorId: string
}) {
  const { previewMode } = useCommandCenterFullscreen()
  const { isBlueprint } = useDashboardWorkspaceView()
  const { selectedEventId, events, setSelectedEventId } = useMarketManagement()

  if (previewMode) {
    return (
      <div className="dashboard-command-center-header dashboard-command-center-header--preview flex min-w-0 items-center justify-end px-3 py-1 sm:px-4">
        <EditPreviewToggle />
      </div>
    )
  }

  if (isBlueprint) {
    return (
      <div className="dashboard-command-center-header dashboard-command-center-header--focus flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden px-3 py-1.5 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 shrink items-center gap-2">
          {selectedEventId ? (
            <>
              <HubGridMarketSelect
                events={events}
                selectedEventId={selectedEventId}
                onSelect={setSelectedEventId}
                className="hidden shrink-0 lg:flex"
              />
              <BlueprintEventMeta />
            </>
          ) : null}
        </div>
        <WorkspaceTabs />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {selectedEventId ? (
            <>
              <HubGridHeaderSaveActions />
              <DashboardSavedLayoutToolbar coordinatorId={coordinatorId} />
            </>
          ) : null}
          <EditPreviewToggle />
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-command-center-header flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden px-3 py-1 sm:gap-2 sm:px-4">
      {selectedEventId ? (
        <>
          <HubGridMarketSelect
            events={events}
            selectedEventId={selectedEventId}
            onSelect={setSelectedEventId}
            className="hidden shrink-0 sm:flex"
          />
          <div className="h-4 w-px shrink-0 bg-stone-200" aria-hidden />
        </>
      ) : null}
      <WorkspaceTabs />
      <div className="ml-auto shrink-0">
        <EditPreviewToggle />
      </div>
    </div>
  )
}
