'use client'

import Link from 'next/link'
import { LayoutGrid, Plus } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { CommandCenterExitLink } from '@/components/coordinator/command-center-exit-link'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { useMarketManagement } from './market-management-context'
import { cn } from '@/lib/utils'

export function DashboardCommandCenterHeader() {
  const { events, selectedEventId, pendingApplications } = useMarketManagement()
  const {
    fullscreen: immersive,
    toggleFullscreen,
    setFullscreen,
    previewMode,
    setPreviewMode,
  } = useCommandCenterFullscreen()
  const selectedEvent = events.find((e) => e.id === selectedEventId)
  const pendingCount = pendingApplications.length

  const headerActions = (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <div
        className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-2 py-1"
        role="group"
        aria-label="Edit or preview floor plan"
      >
        <span
          className={cn(
            'text-xs font-medium',
            !previewMode ? 'text-forest' : 'text-muted-foreground'
          )}
        >
          Edit
        </span>
        <Switch
          size="sm"
          checked={previewMode}
          onCheckedChange={setPreviewMode}
          aria-label={previewMode ? 'Switch to edit mode' : 'Switch to preview mode'}
        />
        <span
          className={cn(
            'text-xs font-medium',
            previewMode ? 'text-forest' : 'text-muted-foreground'
          )}
        >
          Preview
        </span>
      </div>

      <button
        type="button"
        className="relative inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-muted-foreground hover:bg-canvas hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Notifications (live badge placeholder)"
        title="Notifications"
      >
        <span className="sr-only">Notifications</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {pendingCount > 0 ? (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px] leading-none">
            {pendingCount > 9 ? '9+' : pendingCount}
          </Badge>
        ) : (
          <span
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white"
            aria-hidden
            title="Live notification slot"
          />
        )}
      </button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={toggleFullscreen}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
        {immersive ? 'Panels' : 'Full canvas'}
      </Button>
      <Link
        href="/coordinator/payment-methods"
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
      >
        Payments
      </Link>
      {!immersive ? (
        <Link
          href="/coordinator/events/new"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
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
        <h1 className="truncate font-heading text-base font-semibold sm:text-lg">
          {selectedEvent?.name ?? 'Booth layout designer'}
        </h1>
        <p className="hidden text-xs text-muted-foreground sm:block">
          CAD floor plan · layout tools in top toolbar
        </p>
      </div>
      {headerActions}
    </div>
  )
}
