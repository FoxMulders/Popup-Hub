'use client'

import { CommandCenterExitLink } from '@/components/coordinator/command-center-exit-link'
import { cn } from '@/lib/utils'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { DashboardHeaderToolbarPortalTarget } from './dashboard-toolbar-portal'
import { useDashboardWorkspaceView } from './dashboard-workspace-view-context'
import { DashboardSavedLayoutToolbar } from './dashboard-saved-layout-toolbar'
import { HubGridMarketSelect } from './hub-grid-market-picker'
import { useMarketManagement } from './market-management-context'

function WorkspaceTabs() {
  const { view, setView, isBlueprint, isLedger } = useDashboardWorkspaceView()

  return (
    <nav
      className="dashboard-workspace-tabs flex shrink-0 items-center gap-1"
      aria-label="Floor plan workspace"
    >
      <button
        type="button"
        className={cn(
          'dashboard-workspace-tab',
          isBlueprint && 'is-active'
        )}
        aria-current={isBlueprint ? 'page' : undefined}
        onClick={() => setView('blueprint')}
      >
        HubGrid
      </button>
      <button
        type="button"
        className={cn(
          'dashboard-workspace-tab',
          isLedger && 'is-active'
        )}
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
        className={cn(
          'dashboard-pill-toggle__track',
          previewMode && 'is-preview'
        )}
      >
        <span className="dashboard-pill-toggle__thumb" />
      </span>
      <span className={cn('dashboard-pill-toggle__label', previewMode && 'is-active')}>
        Preview
      </span>
    </button>
  )
}

function EventSetupExitLink() {
  const { selectedEventId, events } = useMarketManagement()
  const { setFullscreen } = useCommandCenterFullscreen()
  const selectedEvent = events.find((event) => event.id === selectedEventId)

  if (!selectedEventId) return null

  return (
    <CommandCenterExitLink
      eventId={selectedEventId}
      eventName={selectedEvent?.name}
      eventStatus={selectedEvent?.status}
      compact
      prominent
      onBeforeNavigate={() => setFullscreen(false)}
    />
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
          <EventSetupExitLink />
          <div className="h-4 w-px shrink-0 bg-stone-200" aria-hidden />
        </>
      ) : null}
      <WorkspaceTabs />
      {isBlueprint ? (
        <>
          <DashboardHeaderToolbarPortalTarget className="flex min-w-0 flex-1 items-center overflow-hidden" />
          <DashboardSavedLayoutToolbar coordinatorId={coordinatorId} />
        </>
      ) : null}
      {isBlueprint ? (
        <div className="ml-auto shrink-0">
          <EditPreviewToggle />
        </div>
      ) : null}
    </div>
  )
}
