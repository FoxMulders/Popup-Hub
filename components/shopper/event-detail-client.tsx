'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Calendar, Clock, Users, Map } from 'lucide-react'
import { ExpandableImage } from '@/components/ui/expandable-image'
import { Badge } from '@/components/ui/badge'
import { marketStatusBadge } from '@/lib/theme/market'
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
import { LiveAuctionBanner } from '@/components/auction/live-auction-banner'
import { Button } from '@/components/ui/button'
import type {
  Auction,
  BoothApplication,
  BoothLayout,
  Event,
  EventScheduleItem,
  Role,
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
  upcomingAuction: Auction | null
  lastEndedAuction: Auction | null
  existingReviewRating: number | null
  coordinatorId: string | null
  coordinatorName: string
  userRole: Role | null
  quarterAuctionBanner?: React.ReactNode
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
  upcomingAuction,
  lastEndedAuction,
  existingReviewRating,
  coordinatorId,
  coordinatorName,
  userRole,
  quarterAuctionBanner,
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
            <ExpandableImage
              src={event.cover_image_url}
              alt={event.name}
              className="h-56 w-full object-contain bg-canvas sm:h-64"
            />
          ) : (
            <div className="flex h-40 items-center justify-center bg-gradient-to-br from-harvest-100 to-harvest-50">
              <MapPin className="h-16 w-16 text-harvest-400" />
            </div>
          )}
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{event.name}</h1>
                {event.description && (
                  <p className="mt-2 max-w-2xl text-muted-foreground">{event.description}</p>
                )}
              </div>
              <Badge
                className={`capitalize ${
                  event.status === 'active' ? marketStatusBadge.success : marketStatusBadge.warning
                }`}
              >
                {event.status}
              </Badge>
            </div>

            <div className="mt-4 space-y-2">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-harvest-500" />
                {event.location_name}
                {event.address ? ` · ${event.address}` : ''}
              </p>
              <div className="rounded-lg border bg-canvas p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Schedule</p>
                <ul className="space-y-1">
                  {scheduleLines.map((line) => (
                    <li key={line.label} className="flex flex-wrap gap-x-3 text-sm text-foreground">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-harvest-500" />
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
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0 text-harvest-500" />
                {vendorCount} vendor{vendorCount !== 1 ? 's' : ''} confirmed
              </p>
            </div>

            {coordinator && (
              <div className="mt-4 rounded-xl border bg-canvas px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Organized by
                </p>
                <Link
                  href={`/coordinators/${coordinator.id}`}
                  className="text-sm font-medium text-harvest-700 hover:underline"
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

            <LiveAuctionBanner
              activeAuction={activeAuction}
              upcomingAuction={upcomingAuction}
              lastEndedAuction={lastEndedAuction}
              dismissScope="timer-patron"
              eventId={event.id}
              eventStartAt={event.start_at}
            />
            {quarterAuctionBanner}
          </div>
        </div>

        <GoodToKnowPanel event={event} strollerBadge={strollerBadge} />

        <EventSchedulePanel items={scheduleItems} eventLocation={event.location_name} />

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

        {userRole === 'shopper' && userId && event.status !== 'completed' ? (
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm font-medium">Want to sell at this market?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign up as a vendor or enable vendor access on your profile, then apply from the vendor
              portal. Juried markets review each booth application individually.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/profile">
                <Button size="sm" variant="outline">
                  Enable vendor access
                </Button>
              </Link>
              <Link href={`/vendor/events/${event.id}`}>
                <Button size="sm">Vendor event page</Button>
              </Link>
            </div>
          </div>
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
