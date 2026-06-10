'use client'

import Link from 'next/link'
import { Cloud, LayoutGrid, Plus } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { CommandCenterExitLink } from '@/components/coordinator/command-center-exit-link'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { useDashboardLayoutSave } from './dashboard-layout-save-context'
import { useMarketManagement } from './market-management-context'
import { cn } from '@/lib/utils'

function LayoutSaveChip() {
  const save = useDashboardLayoutSave()
  if (!save || save.status === 'idle') return null

  const label = save.status === 'saving' ? 'Saving…' : 'Saved to cloud'

  return (
    <span
      className="dashboard-save-chip"
      data-status={save.status}
      aria-live="polite"
    >
      <Cloud className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </span>
  )
}

export function DashboardCommandCenterHeader() {
  const { events, selectedEventId } = useMarketManagement()
  const {
    fullscreen: immersive,
    toggleFullscreen,
    setFullscreen,
    previewMode,
    setPreviewMode,
  } = useCommandCenterFullscreen()
  const selectedEvent = events.find((e) => e.id === selectedEventId)

  const headerActions = (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button
        type="button"
        className="dashboard-pill-toggle"
        role="switch"
        aria-checked={previewMode}
        aria-label={previewMode ? 'Switch to edit mode' : 'Switch to preview mode'}
        onClick={() => setPreviewMode(!previewMode)}
      >
        <span
          className={cn(
            !previewMode ? 'text-forest' : 'text-stone-500'
          )}
        >
          Edit
        </span>
        <Switch
          size="sm"
          checked={previewMode}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none"
        />
        <span
          className={cn(
            previewMode ? 'text-forest' : 'text-stone-500'
          )}
        >
          Preview
        </span>
      </button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 rounded-lg"
        onClick={toggleFullscreen}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
        {immersive ? 'Panels' : 'Full canvas'}
      </Button>
      {!immersive ? (
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

  if (immersive) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {selectedEventId ? (
            <CommandCenterExitLink
              eventId={selectedEventId}
              eventName={selectedEvent?.name}
              eventStatus={selectedEvent?.status}
              compact
              prominent
              onBeforeNavigate={() => setFullscreen(false)}
            />
          ) : (
            <span className="truncate text-sm font-medium text-foreground">
              Booth layout designer
            </span>
          )}
        </div>
        {headerActions}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {selectedEvent?.name ?? 'Booth layout designer'}
        </h1>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-stone-600">
            Floor plan designer
          </p>
          <LayoutSaveChip />
        </div>
      </div>
      {headerActions}
    </div>
  )
}
