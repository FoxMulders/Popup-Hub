'use client'

import Link from 'next/link'
import { Check, Cloud, Maximize2, Minimize2, Plus } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { CommandCenterExitLink } from '@/components/coordinator/command-center-exit-link'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { useDashboardLayoutSave } from './dashboard-layout-save-context'
import { useDashboardWorkspaceView } from './dashboard-workspace-view-context'
import { useMarketManagement } from './market-management-context'
import { cn } from '@/lib/utils'

function LayoutSaveChip() {
  const save = useDashboardLayoutSave()
  if (!save || save.status === 'idle') return null

  const saving = save.status === 'saving'

  return (
    <span
      className="dashboard-save-chip"
      data-status={save.status}
      aria-live="polite"
      aria-atomic="true"
    >
      {saving ? (
        <Cloud className="h-3 w-3 shrink-0 animate-pulse" aria-hidden />
      ) : (
        <Check className="h-3 w-3 shrink-0" aria-hidden />
      )}
      {saving ? 'Saving…' : 'Saved to cloud'}
    </span>
  )
}

function WorkspaceTabs() {
  const { view, setView, isBlueprint, isLedger } = useDashboardWorkspaceView()

  return (
    <nav
      className="dashboard-workspace-tabs flex flex-wrap items-center gap-1"
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
        Blueprint Studio
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

export function DashboardCommandCenterHeader() {
  const { events, selectedEventId } = useMarketManagement()
  const {
    fullscreen,
    toggleFullscreen,
    setFullscreen,
    previewMode,
    setPreviewMode,
  } = useCommandCenterFullscreen()
  const { isBlueprint } = useDashboardWorkspaceView()
  const selectedEvent = events.find((e) => e.id === selectedEventId)

  const headerActions = (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {isBlueprint ? (
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
            aria-hidden
          >
            <span className="dashboard-pill-toggle__thumb" />
          </span>
          <span className={cn('dashboard-pill-toggle__label', previewMode && 'is-active')}>
            Preview
          </span>
        </button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 rounded-lg"
        onClick={toggleFullscreen}
      >
        {fullscreen ? (
          <Minimize2 className="h-4 w-4" aria-hidden />
        ) : (
          <Maximize2 className="h-4 w-4" aria-hidden />
        )}
        {fullscreen ? 'Exit full screen' : 'Full screen'}
      </Button>
      {!fullscreen ? (
        <Link
          href="/coordinator/events/new"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5 rounded-lg')}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New market
        </Link>
      ) : null}
    </div>
  )

  if (fullscreen) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {selectedEventId ? (
            <CommandCenterExitLink
              eventId={selectedEventId}
              eventName={selectedEvent?.name}
              eventStatus={selectedEvent?.status}
              compact
              prominent
              onBeforeNavigate={() => setFullscreen(false)}
            />
          ) : null}
          <WorkspaceTabs />
        </div>
        {headerActions}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {selectedEvent?.name ?? 'Booth layout designer'}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-stone-600">
              {isBlueprint ? 'Blueprint Studio' : 'Allocation Ledger'}
            </p>
            <LayoutSaveChip />
          </div>
        </div>
        {headerActions}
      </div>
      <WorkspaceTabs />
    </div>
  )
}
