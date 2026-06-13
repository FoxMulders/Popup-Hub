'use client'

import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SavedLayoutPicker } from '@/components/coordinator/saved-layout-picker'
import { TestSuitePopulateButton } from '@/components/coordinator/test-suite-populate-button'
import { cn } from '@/lib/utils'
import { WIZARD_DRAFT_BADGE } from '@/lib/wizard/wizard-panel-styles'
import type { LayoutRoom } from '@/types/database'

export interface LayoutPlannerHeaderProps {
  mode: 'wizard' | 'standalone'
  eventName: string
  eventId?: string
  hasOverlap?: boolean
  onSave?: () => void
  saveDisabled?: boolean
  saveLoading?: boolean
  saveLabel?: string
  /** Wizard — back within setup flow */
  onBack?: () => void
  /** Standalone — link target (defaults to event detail) */
  backHref?: string
  backLabel?: string
  stepLabel?: string
  title?: string
  showDraftBadge?: boolean
  fullEditorHref?: string
  coordinatorId?: string
  locationName?: string
  address?: string
  getLayoutSnapshot?: () => { rooms: LayoutRoom[]; activeRoomId: string } | null
  onApplySavedLayout?: (rooms: LayoutRoom[], activeRoomId: string) => void
  savedLayoutDisabled?: boolean
  className?: string
}

export function LayoutPlannerHeader({
  mode,
  eventName,
  eventId,
  hasOverlap = false,
  onSave,
  saveDisabled = false,
  saveLoading = false,
  saveLabel = 'Save & deploy',
  onBack,
  backHref,
  backLabel = 'Back to event',
  stepLabel,
  title = 'Spatial layout',
  showDraftBadge = false,
  fullEditorHref,
  coordinatorId,
  locationName = '',
  address = '',
  getLayoutSnapshot,
  onApplySavedLayout,
  savedLayoutDisabled = false,
  className,
}: LayoutPlannerHeaderProps) {
  const resolvedBackHref = backHref ?? (eventId ? `/coordinator/events/${eventId}` : '/coordinator/events')

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-200/80 bg-card/90 px-3 py-2.5 backdrop-blur-sm sm:px-4',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        {mode === 'wizard' && onBack ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-muted-foreground"
              onClick={onBack}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back
            </Button>
            {eventId ? (
              <Link
                href={`/coordinator/events/${eventId}`}
                className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-canvas hover:text-foreground"
              >
                Event overview
              </Link>
            ) : null}
          </div>
        ) : (
          <Link
            href={resolvedBackHref}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-canvas hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {backLabel}
          </Link>
        )}

        <div className="min-w-0">
          {stepLabel ? (
            <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {stepLabel}
            </p>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h1 className="font-heading text-base font-bold tracking-tight text-forest sm:text-lg">
              {title}
            </h1>
            {eventName ? (
              <span className="truncate text-sm font-medium text-foreground/80 max-w-[32ch]">
                {eventName}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hasOverlap ? (
          <span
            className="rounded-md border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-950"
            role="status"
          >
            Overlaps detected
          </span>
        ) : null}
        {showDraftBadge ? (
          <span className={WIZARD_DRAFT_BADGE} aria-label="Event status">
            Draft
          </span>
        ) : null}
        {fullEditorHref ? (
          <Link
            href={fullEditorHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 text-xs font-medium text-foreground hover:bg-canvas"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Full editor
          </Link>
        ) : null}
        {eventId ? <TestSuitePopulateButton eventId={eventId} compact /> : null}
        {coordinatorId && getLayoutSnapshot && onApplySavedLayout ? (
          <SavedLayoutPicker
            coordinatorId={coordinatorId}
            locationName={locationName}
            address={address}
            getLayoutSnapshot={getLayoutSnapshot}
            onApplyLayout={onApplySavedLayout}
            compact
            disabled={savedLayoutDisabled}
          />
        ) : null}
        {onSave ? (
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0"
            disabled={saveDisabled || saveLoading}
            onClick={onSave}
          >
            {saveLoading ? 'Saving…' : saveLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
