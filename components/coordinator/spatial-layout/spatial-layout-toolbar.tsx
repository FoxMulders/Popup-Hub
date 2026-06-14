'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LayoutEditorHelpButton } from '@/components/coordinator/floor-plan-v2/tools/layout-editor-help'
import { SavedLayoutPicker } from '@/components/coordinator/saved-layout-picker'
import { TestSuitePopulateButton } from '@/components/coordinator/test-suite-populate-button'
import { cn } from '@/lib/utils'
import { WIZARD_DRAFT_BADGE } from '@/lib/wizard/wizard-panel-styles'
import type { LayoutRoom } from '@/types/database'

export interface SpatialLayoutToolbarProps {
  eventId: string
  eventName: string
  coordinatorId: string
  locationName: string
  address: string
  placedCount: number
  layoutCapacity: number
  hasOverlap: boolean
  isDraft: boolean
  saving: boolean
  savingDraft?: boolean
  onSave: () => void
  onSaveDraft?: () => void
  saveLabel: string
  onReloadFromServer?: () => void
  getLayoutSnapshot: () => { rooms: LayoutRoom[]; activeRoomId: string } | null
  onApplySavedLayout: (rooms: LayoutRoom[], activeRoomId: string) => void
}

export function SpatialLayoutToolbar({
  eventId,
  eventName,
  coordinatorId,
  locationName,
  address,
  placedCount,
  layoutCapacity,
  hasOverlap,
  isDraft,
  saving,
  savingDraft = false,
  onSave,
  onSaveDraft,
  saveLabel,
  onReloadFromServer,
  getLayoutSnapshot,
  onApplySavedLayout,
}: SpatialLayoutToolbarProps) {
  return (
    <header
      className="flex shrink-0 items-center gap-2 border-b border-stone-200/80 bg-card/95 px-2 py-1.5 backdrop-blur-sm sm:gap-3 sm:px-3"
    >
      <Link
        href={`/coordinator/events/${eventId}`}
        prefetch
        className="relative z-20 inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-canvas hover:text-foreground sm:px-2 sm:text-sm"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Event overview</span>
        <span className="sm:hidden">Back</span>
      </Link>

      <div
        className="hidden h-4 w-px shrink-0 bg-stone-200 sm:block"
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <h1 className="shrink-0 font-heading text-sm font-bold tracking-tight text-forest sm:text-base">
          Spatial layout
        </h1>
        {eventName ? (
          <span className="min-w-0 truncate text-xs font-medium text-muted-foreground sm:max-w-[28ch] sm:text-sm">
            {eventName}
          </span>
        ) : null}
        <LayoutEditorHelpButton
          variant="prominent"
          size="sm"
          className="h-7 shrink-0 px-2.5 text-xs sm:h-8 sm:px-3"
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-xs tabular-nums text-muted-foreground sm:gap-2">
        <span className="rounded-md border border-stone-200 bg-white px-2 py-0.5 font-medium text-foreground">
          {placedCount} of {layoutCapacity} max
        </span>
        {hasOverlap ? (
          <span
            className="rounded-md border border-amber-300/80 bg-amber-50 px-2 py-0.5 font-medium text-amber-950"
            role="status"
          >
            Overlaps
          </span>
        ) : null}
        {isDraft ? (
          <span className={cn(WIZARD_DRAFT_BADGE, 'py-0.5')} aria-label="Event status">
            Draft
          </span>
        ) : null}
        <SavedLayoutPicker
          coordinatorId={coordinatorId}
          locationName={locationName}
          address={address}
          getLayoutSnapshot={getLayoutSnapshot}
          onApplyLayout={onApplySavedLayout}
          compact
          disabled={saving || savingDraft}
        />
        <TestSuitePopulateButton eventId={eventId} compact />
        {onReloadFromServer ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden h-7 shrink-0 px-2 text-xs lg:inline-flex"
            disabled={saving}
            onClick={onReloadFromServer}
          >
            Reload
          </Button>
        ) : null}
        <span
          data-layout-help="save-actions"
          className="inline-flex shrink-0 items-center gap-1.5"
        >
          {onSaveDraft ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2.5 text-xs sm:h-8"
              disabled={hasOverlap || saving || savingDraft}
              onClick={onSaveDraft}
            >
              {savingDraft ? 'Saving…' : 'Save draft'}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-7 shrink-0 px-2.5 text-xs sm:h-8"
            disabled={hasOverlap || saving || savingDraft}
            onClick={onSave}
          >
            {saving ? 'Saving…' : saveLabel}
          </Button>
        </span>
      </div>
    </header>
  )
}
