'use client'

import Link from 'next/link'
import { Map } from 'lucide-react'
import { PublicFloorplan } from '@/components/shopper/public-floorplan'
import { layoutHasDrawableGeometry } from '@/lib/booth-planner/layout-rooms'
import { patronEventMapUrl, vendorSetupMapUrl } from '@/lib/shopper/public-floorplan-modes'
import type { BoothLayout, Event } from '@/types/database'

export interface MarketApplicationLayoutViewProps {
  /** Event row — supplies id, name, and status for map links and copy. */
  eventData: Pick<Event, 'id' | 'name' | 'status'>
  /** Saved booth layout row id when present (same as booth_layouts.id). */
  layoutId?: string | null
  layout: BoothLayout | null
  /** Highlight an assigned booth number when the vendor already has placement. */
  highlightBoothNumber?: number | null
  className?: string
}

/**
 * Read-only venue map for the vendor market application flow.
 * Role-agnostic — coordinators and vendors share the same preview path.
 */
export function MarketApplicationLayoutView({
  eventData,
  layoutId,
  layout,
  highlightBoothNumber = null,
  className,
}: MarketApplicationLayoutViewProps) {
  const hasGeometry = layoutHasDrawableGeometry(layout)
  const hasAssignedBooth = highlightBoothNumber != null

  if (!hasGeometry || !layout) {
    return (
      <section
        className={className}
        aria-labelledby="market-layout-heading"
        data-layout-id={layoutId ?? undefined}
        data-event-id={eventData.id}
      >
        <h2 id="market-layout-heading" className="mb-2 text-lg font-semibold text-foreground">
          Venue layout
        </h2>
        <p className="rounded-xl border border-dashed bg-canvas px-4 py-6 text-sm text-muted-foreground">
          The organizer has not published a floor plan for this market yet. You can still apply —
          booth placement is assigned after approval.
        </p>
      </section>
    )
  }

  const mapHref = hasAssignedBooth
    ? vendorSetupMapUrl(eventData.id)
    : patronEventMapUrl(eventData.id)

  return (
    <section
      className={className}
      aria-labelledby="market-layout-heading"
      data-layout-id={layoutId ?? layout.id}
      data-event-id={eventData.id}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="market-layout-heading" className="text-lg font-semibold text-foreground">
          {hasAssignedBooth ? 'Your booth' : 'Venue layout'}
        </h2>
        <Link
          href={mapHref}
          className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-forest hover:underline"
        >
          <Map className="h-4 w-4" aria-hidden />
          {hasAssignedBooth ? 'Open setup map' : 'Open full map'}
        </Link>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        {hasAssignedBooth
          ? `Booth #${highlightBoothNumber} is on the floor plan at ${eventData.name}. Use the setup map for load-in directions from the entrance.`
          : `Preview where booths sit at ${eventData.name}. Your exact spot is assigned after the organizer approves your application.`}
      </p>
      <div className="overflow-hidden rounded-2xl border bg-white p-3 sm:p-4">
        <PublicFloorplan
          layout={layout}
          highlightBoothNumber={highlightBoothNumber}
          mode={hasAssignedBooth ? 'vendor-setup' : 'patron'}
          showRouteModePicker={!hasAssignedBooth}
        />
      </div>
    </section>
  )
}
