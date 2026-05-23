'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Calendar, Clock, Users, Map } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CoordinatorReliabilityBadge } from '@/components/coordinator/coordinator-reliability-badge'
import { EventActionBar } from '@/components/shopper/event-action-bar'
import { VendorLineup } from '@/components/shopper/vendor-lineup'
import { VendorSheet } from '@/components/shopper/vendor-sheet'
import { GoodToKnowPanel } from '@/components/shopper/good-to-know-panel'
import { PublicFloorplan } from '@/components/shopper/public-floorplan'
import { ProductSneakPeek } from '@/components/shopper/product-sneak-peek'
import { EventSchedulePanel } from '@/components/shopper/event-schedule-panel'
import { ReviewSection } from '@/components/shopper/review-section'
import { VendorReviewsPanel } from '@/components/shopper/vendor-reviews-panel'
import { buildScheduleLines } from '@/lib/shopper/events'
import { buildVendorLineup, type VendorLineupEntry } from '@/lib/shopper/vendors'
import { VendorAccessRequestForm } from '@/components/shopper/vendor-access-request-form'
import type {
  Auction,
  BoothApplication,
  BoothLayout,
  Event,
  EventScheduleItem,
  Role,
  VendorAccessRequest,
  VendorProduct,
} from '@/types/database'
import type { StrollerBadge } from '@/lib/shopper/layout'

interface EventDetailClientProps {
  event: Event
  applications: BoothApplication[]
  layout: BoothLayout | null
  strollerBadge: StrollerBadge
  favorited: boolean
  userId: string | null
  reminderOffsets: string[]
  followVendorIds: string[]
  products: (VendorProduct & { vendor_name?: string; vendor_id: string })[]
  scheduleItems: EventScheduleItem[]
  activeAuction: Auction | null
  existingReviewRating: number | null
  coordinatorId: string | null
  coordinatorName: string
  vendorAccessRequest: VendorAccessRequest | null
  userRole: Role | null
}

export function EventDetailClient({
  event,
  applications,
  layout,
  strollerBadge,
  favorited,
  userId,
  reminderOffsets,
  followVendorIds,
  products,
  scheduleItems,
  activeAuction,
  existingReviewRating,
  coordinatorId,
  coordinatorName,
  vendorAccessRequest,
  userRole,
}: EventDetailClientProps) {
  const [selectedVendor, setSelectedVendor] = useState<VendorLineupEntry | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator
  const scheduleLines = buildScheduleLines(event)
  const vendorCount = applications.length
  const vendorLineup = buildVendorLineup(applications)

  function openVendor(v: VendorLineupEntry) {
    setSelectedVendor(v)
    setSheetOpen(true)
  }

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 pb-32">
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {event.cover_image_url ? (
            <img src={event.cover_image_url} alt={event.name} className="h-56 w-full object-cover sm:h-64" />
          ) : (
            <div className="flex h-40 items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
              <MapPin className="h-16 w-16 text-amber-300" />
            </div>
          )}
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-heading text-2xl font-bold text-gray-900 sm:text-3xl">{event.name}</h1>
                {event.description && (
                  <p className="mt-2 max-w-2xl text-gray-600">{event.description}</p>
                )}
              </div>
              <Badge
                className={`capitalize ${
                  event.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {event.status}
              </Badge>
            </div>

            <div className="mt-4 space-y-2">
              <p className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 shrink-0 text-amber-500" />
                {event.location_name}
                {event.address ? ` · ${event.address}` : ''}
              </p>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Schedule</p>
                <ul className="space-y-1">
                  {scheduleLines.map((line) => (
                    <li key={line.label} className="flex flex-wrap gap-x-3 text-sm text-gray-700">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-amber-500" />
                        {line.label}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {line.hours}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="h-4 w-4 shrink-0 text-amber-500" />
                {vendorCount} vendor{vendorCount !== 1 ? 's' : ''} confirmed
              </p>
            </div>

            {coordinator && (
              <div className="mt-4 rounded-xl border bg-gray-50 px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Organized by
                </p>
                <Link
                  href={`/coordinators/${coordinator.id}`}
                  className="text-sm font-medium text-amber-800 hover:underline"
                >
                  {coordinator.full_name}
                </Link>
                <div className="mt-2">
                  <CoordinatorReliabilityBadge
                    score={coordinator.reliability_score ?? 100}
                    recentLateCancellationAt={coordinator.recent_late_cancellation_at}
                    size="sm"
                  />
                </div>
              </div>
            )}

            {activeAuction && (
              <div className="mt-4 rounded-xl border border-harvest-200 bg-harvest-50 px-4 py-3">
                <p className="text-sm font-semibold text-harvest-900">Live auction happening now</p>
                <Link href={`/auctions/${activeAuction.id}`} className="mt-2 inline-block text-sm font-medium text-forest underline">
                  Join {activeAuction.title} →
                </Link>
              </div>
            )}
          </div>
        </div>

        <GoodToKnowPanel event={event} strollerBadge={strollerBadge} />

        <EventSchedulePanel items={scheduleItems} />

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold">Who&apos;s going</h2>
            {layout && (
              <Link
                href={`/events/${event.id}/map`}
                className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-forest hover:underline"
              >
                <Map className="h-4 w-4" />
                Floor plan
              </Link>
            )}
          </div>
          <VendorLineup applications={applications} onSelectVendor={openVendor} />
        </section>

        {layout && (
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-4 font-heading text-lg font-semibold">Venue map</h2>
            <PublicFloorplan layout={layout} />
          </section>
        )}

        <ProductSneakPeek products={products} eventId={event.id} userId={userId} />

        {event.status === 'completed' && (
          <>
            <ReviewSection
              eventId={event.id}
              userId={userId}
              existingRating={existingReviewRating}
            />
            <VendorReviewsPanel
              eventId={event.id}
              userId={userId}
              vendors={vendorLineup}
            />
          </>
        )}

        {userRole === 'vendor' && coordinatorId && event.status !== 'completed' ? (
          <VendorAccessRequestForm
            coordinatorId={coordinatorId}
            coordinatorName={coordinatorName}
            userId={userId}
            existingRequest={vendorAccessRequest}
          />
        ) : null}
      </div>

      <EventActionBar
        event={event}
        favorited={favorited}
        userId={userId}
        existingReminderOffsets={reminderOffsets}
      />

      <VendorSheet
        vendor={selectedVendor}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        eventId={event.id}
        mapHref={`/events/${event.id}/map`}
        userId={userId}
        initialFollowing={
          selectedVendor ? followVendorIds.includes(selectedVendor.vendor_id) : false
        }
      />
    </>
  )
}
