'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { DashboardHeaderToolbarPortalTarget } from './dashboard-toolbar-portal'
import { useDashboardWorkspaceView } from './dashboard-workspace-view-context'
import { cn } from '@/lib/utils'

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
  const { fullscreen, previewMode, setPreviewMode } = useCommandCenterFullscreen()
  const { isBlueprint } = useDashboardWorkspaceView()

  const headerActions = (
    <div className="flex shrink-0 items-center gap-2">
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
          >
            <span className="dashboard-pill-toggle__thumb" />
          </span>
          <span className={cn('dashboard-pill-toggle__label', previewMode && 'is-active')}>
            Preview
          </span>
        </button>
      ) : null}

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

  return (
    <div className="dashboard-command-center-header flex flex-nowrap items-center gap-2 overflow-x-auto px-3 py-1 sm:px-4">
      <WorkspaceTabs />
      {isBlueprint && !previewMode ? (
        <DashboardHeaderToolbarPortalTarget className="flex min-w-0 flex-1 items-center" />
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-2">{headerActions}</div>
    </div>
  )
}
