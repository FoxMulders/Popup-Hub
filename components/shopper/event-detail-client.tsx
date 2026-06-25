'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MapPin, Calendar, Clock, Users, Map } from 'lucide-react'
import { SitePageBand } from '@/components/layout/site-page-band'
import { ExpandableImage } from '@/components/ui/expandable-image'
import { Badge } from '@/components/ui/badge'
import { marketStatusBadge } from '@/lib/theme/market'
import { CoordinatorReliabilityBadge } from '@/components/coordinator/coordinator-reliability-badge'
import { CoordinatorFollowButton } from '@/components/shopper/coordinator-follow-button'
import { EventActionBar } from '@/components/shopper/event-action-bar'
import { VendorLineup } from '@/components/shopper/vendor-lineup'
import { VendorSheet } from '@/components/shopper/vendor-sheet'
import { GoodToKnowPanel } from '@/components/shopper/good-to-know-panel'
import { PublicFloorplan } from '@/components/shopper/public-floorplan'
import { ProductSneakPeek } from '@/components/shopper/product-sneak-peek'
import { EventSchedulePanel } from '@/components/shopper/event-schedule-panel'
import { ReviewSection } from '@/components/shopper/review-section'
import { VendorReviewsPanel } from '@/components/shopper/vendor-reviews-panel'
import { patronEventMapUrl } from '@/lib/shopper/public-floorplan-modes'
import { buildScheduleLines } from '@/lib/shopper/events'
import { buildVendorLineup, type VendorLineupEntry } from '@/lib/shopper/vendors'
import { formatCents } from '@/lib/square/client'
import { LiveAuctionBanner } from '@/components/auction/live-auction-banner'
import { Button } from '@/components/ui/button'
import { MarketPassportPanel } from '@/components/market-passport/market-passport-panel'
import { MeetTheMakerSection } from '@/components/market-feed/meet-the-maker-section'
import { PassportStoriesPublicStrip } from '@/components/passport/passport-stories-public-strip'
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
  followingCoordinator?: boolean
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
  followingCoordinator = false,
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
  const [mapHighlightBooth, setMapHighlightBooth] = useState<number | null>(null)
  const searchParams = useSearchParams()
  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator
  const scheduleLines = buildScheduleLines(event)
  const vendorCount = applications.length
  const vendorLineup = useMemo(() => buildVendorLineup(applications), [applications])

  function openVendor(v: VendorLineupEntry) {
    setSelectedVendor(v)
    setSheetOpen(true)
  }

  function focusBoothOnMap(boothNumber: number) {
    setMapHighlightBooth(boothNumber)
    document.getElementById('venue-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const vendorId = searchParams.get('vendor')
    if (!vendorId) return
    const match = vendorLineup.find((v) => v.vendor_id === vendorId)
    if (match) openVendor(match)
  }, [searchParams, vendorLineup])

  return (
    <>
      <SitePageBand
        eyebrow="Market detail"
        title={event.name}
        description={event.description ?? undefined}
        tone="subtle"
      />

      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-8 px-4 py-8 pb-32">
        <div className="marketing-glass-card w-full min-w-0 overflow-hidden">
          {event.cover_image_url ? (
            <ExpandableImage
              src={event.cover_image_url}
              alt={event.name}
              className="h-56 w-full object-cover bg-canvas sm:h-72"
            />
          ) : (
            <div className="flex h-44 items-center justify-center bg-gradient-to-br from-sage-100 via-canvas to-harvest-50 sm:h-56">
              <MapPin className="h-16 w-16 text-harvest-400" aria-hidden />
            </div>
          )}
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-sage-700">When &amp; where</p>
              <Badge
                className={`capitalize shrink-0 ${
                  event.status === 'active' ? marketStatusBadge.success : marketStatusBadge.warning
                }`}
              >
                {event.status}
              </Badge>
            </div>

            <div className="mt-4 space-y-3">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-harvest-500" aria-hidden />
                <span className="min-w-0 break-words">
                  {event.location_name}
                  {event.address ? ` · ${event.address}` : ''}
                </span>
              </p>
              <div className="rounded-xl border border-stone-200/60 bg-canvas/80 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Schedule
                </p>
                <ul className="space-y-1">
                  {scheduleLines.map((line) => (
                    <li key={line.label} className="flex flex-wrap gap-x-3 text-sm text-foreground">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-harvest-500" aria-hidden />
                        {line.label}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {line.hours}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0 text-harvest-500" aria-hidden />
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
                {userId && userId !== coordinator.id ? (
                  <div className="mt-3">
                    <CoordinatorFollowButton
                      coordinatorId={coordinator.id}
                      coordinatorName={coordinator.full_name}
                      initialFollowing={followingCoordinator}
                      size="sm"
                    />
                  </div>
                ) : null}
                <div className="mt-3">
                  <PassportStoriesPublicStrip
                    ownerId={coordinator.id}
                    displayName={coordinator.full_name}
                    avatarUrl={coordinator.avatar_url}
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

        {['published', 'active'].includes(event.status) ? (
          <MarketPassportPanel eventId={event.id} eventStatus={event.status} />
        ) : null}

        <MeetTheMakerSection eventId={event.id} eventStatus={event.status} />

        <EventSchedulePanel items={scheduleItems} eventLocation={event.location_name} />

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-foreground">Who&apos;s going</h2>
            {layout ? (
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="#venue-map"
                  className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-forest hover:underline"
                >
                  <Map className="h-4 w-4" />
                  Explore floor plan
                </a>
                <Link
                  href={patronEventMapUrl(event.id)}
                  className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Full screen
                </Link>
              </div>
            ) : null}
          </div>
          <VendorLineup
            applications={applications}
            eventId={event.id}
            onSelectVendor={openVendor}
            onViewBoothOnMap={layout ? focusBoothOnMap : undefined}
          />
        </section>

        {layout ? (
          <section id="venue-map" className="marketing-glass-card scroll-mt-24 p-5">
            <h2 className="mb-4 text-lg font-bold text-foreground">Venue map</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Search vendors, tap a booth, or follow a route through the market.
            </p>
            <PublicFloorplan
              layout={layout}
              highlightBoothNumber={mapHighlightBooth}
              mode="patron"
            />
          </section>
        ) : null}

        <ProductSneakPeek products={products} eventId={event.id} userId={userId} />

        {event.status === 'completed' && (
          <>
            {userId ? (
              <section className="rounded-2xl border border-harvest-200 bg-gradient-to-br from-harvest-50 to-white p-5">
                <h2 className="font-heading text-lg font-semibold">My Night at the Auction</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Revisit every maker you discovered and every item you backed — your personal local
                  business directory from this market.
                </p>
                <Link href={`/events/${event.id}/my-night`} className="mt-3 inline-block">
                  <Button size="sm">View your recap</Button>
                </Link>
              </section>
            ) : null}
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
          <div className="marketing-glass-card p-4">
            <p className="text-sm font-medium">Want to sell at this market?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign up as a vendor or enable vendor access on your profile, then apply from the vendor
              portal. Juried markets review each booth application individually.
            </p>
            {/*
             * Public registration card — booth fee is the headline
             * vendors care about. We surface it prominently so shoppers
             * thinking about flipping into a vendor know exactly what
             * the booth costs before they tap through.
             */}
            {(() => {
              const limits = event.category_limits ?? []
              if (limits.length === 0) return null
              const fees = limits
                .map((cl) => cl.price_per_booth ?? 0)
                .filter((cents) => Number.isFinite(cents) && cents >= 0)
              if (fees.length === 0) return null
              const minFee = Math.min(...fees)
              const maxFee = Math.max(...fees)
              const allFree = maxFee === 0
              const display = allFree
                ? 'Free'
                : minFee === maxFee
                  ? formatCents(minFee)
                  : `${formatCents(minFee)} – ${formatCents(maxFee)}`
              return (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-harvest-200 bg-harvest-50/40 px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">Booth fee</span>
                  <span className="font-semibold text-harvest-900">{display}</span>
                </div>
              )
            })()}
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
        userId={userId}
        initialFollowing={
          selectedVendor ? followVendorIds.includes(selectedVendor.vendor_id) : false
        }
      />
    </>
  )
}
