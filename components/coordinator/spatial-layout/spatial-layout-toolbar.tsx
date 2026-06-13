'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TestSuitePopulateButton } from '@/components/coordinator/test-suite-populate-button'
import { cn } from '@/lib/utils'
import { WIZARD_DRAFT_BADGE } from '@/lib/wizard/wizard-panel-styles'

export interface SpatialLayoutToolbarProps {
  eventId: string
  eventName: string
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
}

export function SpatialLayoutToolbar({
  eventId,
  eventName,
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
}: SpatialLayoutToolbarProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-200/80 bg-card/95 px-3 py-2.5 backdrop-blur-sm sm:px-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link
          href={`/coordinator/events/${eventId}`}
          prefetch
          className="relative z-20 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-canvas hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Event overview
        </Link>
        <div className="min-w-0">
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Floor plan
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h1 className="font-heading text-base font-bold tracking-tight text-forest sm:text-lg">
              Spatial layout
            </h1>
            {eventName ? (
              <span className="max-w-[32ch] truncate text-sm font-medium text-foreground/80">
                {eventName}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
        <span className="rounded-md border border-stone-200 bg-white px-2.5 py-1 font-medium text-foreground">
          {placedCount} of {layoutCapacity} max
        </span>
        {hasOverlap ? (
          <span
            className="rounded-md border border-amber-300/80 bg-amber-50 px-2.5 py-1 font-medium text-amber-950"
            role="status"
          >
            Overlaps
          </span>
        ) : null}
        {isDraft ? (
          <span className={cn(WIZARD_DRAFT_BADGE, 'py-1')} aria-label="Event status">
            Draft
          </span>
        ) : null}
        <TestSuitePopulateButton eventId={eventId} compact />
        {onReloadFromServer ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={saving}
            onClick={onReloadFromServer}
          >
            Reload saved layout
          </Button>
        ) : null}
        {onSaveDraft ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={hasOverlap || saving || savingDraft}
            onClick={onSaveDraft}
          >
            {savingDraft ? 'Saving draft…' : 'Save draft'}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0"
          disabled={hasOverlap || saving || savingDraft}
          onClick={onSave}
        >
          {saving ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </header>
  )
}
