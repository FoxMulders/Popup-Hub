import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { VendorEventApplySection } from '@/components/vendor/vendor-event-apply-section'
import { MarketFeedbackWidget } from '@/components/coordinator/market-feedback-widget'
import { CoordinatorReliabilityBadge } from '@/components/coordinator/coordinator-reliability-badge'
import { formatCents } from '@/lib/square/client'
import { fetchEventCapacitySummary, formatCapacityRemaining, getVendorEligibleCategoryLimits } from '@/lib/queries/event-capacity'
import {
  getEventDisplayStatus,
  isEventOpenForApplications,
  VENDOR_EVENT_SELECT,
  VENDOR_MARKET_STATUSES,
} from '@/lib/queries/events'
import { format } from 'date-fns'
import { ExpandableImage } from '@/components/ui/expandable-image'
import { ArrowLeft, Calendar, Clock, MapPin, AlertTriangle } from 'lucide-react'
import { LiveAuctionBanner } from '@/components/auction/live-auction-banner'
import { QuarterAuctionEventBanner } from '@/components/quarter-auction/event-banner'
import { summarizeEventAuctions } from '@/lib/auction/event-auctions'
import { isPassportReadyForApplication } from '@/lib/vendor/passport-application'
import { isQuarterAuctionListing } from '@/lib/events/listing-type'
import { computeApplicationBoothPriceCents } from '@/lib/monetization/booth-pricing'
import { vendorCanVouchForCoordinator } from '@/lib/coordinator/vouch'
import { MarketOwnerLink } from '@/components/vendor/market-owner-link'
import { MarketApplicationLayoutView } from '@/components/events/market-application-layout-view'
import { VendorEventVenueMap } from '@/components/vendor/vendor-event-venue-map'
import type { Auction, BoothLayout, Event, EventCategoryLimit } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function VendorEventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/vendor/events/${id}`)}`)

  const [
    { data: event, error: eventError },
    { data: existingApp, error: appError },
    { data: layoutRow },
    { data: eventAuctions },
    { data: wallet },
    { data: passport },
  ] = await Promise.all([
    supabase
      .from('events')
      .select(VENDOR_EVENT_SELECT)
      .eq('id', id)
      .in('status', VENDOR_MARKET_STATUSES)
      .maybeSingle(),
    supabase
      .from('booth_applications')
      .select(
        'id, status, payment_status, payment_method, application_payment_status, category_id, table_count, booth_number'
      )
      .eq('event_id', id)
      .eq('vendor_id', user.id)
      .maybeSingle(),
    supabase.from('booth_layouts').select('*').eq('event_id', id).maybeSingle(),
    supabase
      .from('auctions')
      .select('*')
      .eq('event_id', id)
      .in('status', ['upcoming', 'active', 'ended'])
      .order('created_at', { ascending: false }),
    supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('vendor_passports')
      .select(
        'business_name, primary_category_id, category_ids, verification_status, account_status, risk_score'
      )
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (eventError) {
    console.error('[vendor/events/[id]] event query failed', {
      eventId: id,
      message: eventError.message,
      code: eventError.code,
    })
  }

  if (appError) {
    console.error('[vendor/events/[id]] application query failed', {
      eventId: id,
      message: appError.message,
      code: appError.code,
    })
  }

  let resolvedEvent = event
  if (!resolvedEvent) {
    const { data: vendorApp } = await supabase
      .from('booth_applications')
      .select('id')
      .eq('event_id', id)
      .eq('vendor_id', user.id)
      .maybeSingle()

    if (vendorApp) {
      const { data: fallbackEvent, error: fallbackError } = await supabase
        .from('events')
        .select(VENDOR_EVENT_SELECT)
        .eq('id', id)
        .maybeSingle()

      if (fallbackError) {
        console.error('[vendor/events/[id]] fallback event query failed', {
          eventId: id,
          message: fallbackError.message,
          code: fallbackError.code,
        })
      }

      resolvedEvent = fallbackEvent
    }
  }

  if (!resolvedEvent) notFound()

  const eventRecord = resolvedEvent

  const isQuarterAuction = isQuarterAuctionListing(eventRecord.listing_type)
  const capacity = await fetchEventCapacitySummary(supabase, eventRecord as Event)
  const coordinator = Array.isArray(eventRecord.coordinator) ? eventRecord.coordinator[0] : eventRecord.coordinator
  const displayStatus = getEventDisplayStatus(eventRecord, undefined, {
    isFullyBooked: capacity.isFullyBooked,
  })
  const applicationsOpen = isEventOpenForApplications(eventRecord)

  const sortedLimits = getVendorEligibleCategoryLimits(eventRecord as Event).sort(
    (a: EventCategoryLimit, b: EventCategoryLimit) =>
      (a.category?.name ?? '').localeCompare(b.category?.name ?? '')
  )
  const eventCapacityLabel = formatCapacityRemaining(capacity.totalAvailable, capacity.totalMaxSlots)
  const auctionSummary = summarizeEventAuctions((eventAuctions ?? []) as Auction[])
  const passportReady = isPassportReadyForApplication(passport)
  const vendorCanVouch = vendorCanVouchForCoordinator(passport).ok
  const boothPriceCents = existingApp?.category_id
    ? computeApplicationBoothPriceCents(
        sortedLimits.find((cl) => cl.category_id === existingApp.category_id)?.price_per_booth,
        eventRecord,
        existingApp.table_count ?? 1
      )
    : 0
  const paidCategoryLimits = sortedLimits.filter((cl) => cl.price_per_booth > 0)
  const minBoothFee = paidCategoryLimits.length
    ? Math.min(...paidCategoryLimits.map((cl) => cl.price_per_booth))
    : 0
  const maxBoothFee = paidCategoryLimits.length
    ? Math.max(...paidCategoryLimits.map((cl) => cl.price_per_booth))
    : 0

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/vendor/dashboard">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <Link href="/vendor/events">
          <Button variant="ghost" size="sm" className="gap-1.5">
            All markets
          </Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {eventRecord.cover_image_url ? (
          <ExpandableImage
            src={eventRecord.cover_image_url}
            alt={eventRecord.name}
            className="h-48 w-full object-contain bg-canvas"
          />
        ) : (
          <div className="flex h-32 items-center justify-center bg-gradient-to-br from-harvest-100 to-harvest-50">
            <MapPin className="h-12 w-12 text-harvest-400" />
          </div>
        )}
        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-foreground">{eventRecord.name}</h1>
            <div className="flex flex-wrap gap-2">
              <Badge className="capitalize">
                {displayStatus === 'archived'
                  ? 'Archived'
                  : displayStatus === 'full'
                    ? 'Full'
                    : displayStatus}
              </Badge>
              <Badge className="capitalize">
                {eventRecord.booking_mode === 'juried' ? 'Juried review' : 'Instant book'}
              </Badge>
            </div>
          </div>
          {capacity.totalMaxSlots > 0 ? (
            <p className="text-sm font-medium text-foreground">{eventCapacityLabel}</p>
          ) : null}
          {eventRecord.description ? <p className="text-sm text-muted-foreground">{eventRecord.description}</p> : null}
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-harvest-500" />
              <span>{eventRecord.location_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-harvest-500" />
              {format(new Date(eventRecord.start_at), 'EEE, MMM d, yyyy')}
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Clock className="h-4 w-4 shrink-0 text-harvest-500" />
              {format(new Date(eventRecord.start_at), 'h:mm a')} – {format(new Date(eventRecord.end_at), 'h:mm a')}
            </div>
          </div>
          {coordinator ? (
            <div className="rounded-xl border bg-canvas px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organizer</p>
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
          ) : null}
          <LiveAuctionBanner
            activeAuction={auctionSummary.active}
            upcomingAuction={auctionSummary.upcoming}
            lastEndedAuction={auctionSummary.lastEnded}
            walletBalanceCents={wallet?.balance ?? 0}
            dismissScope="timer-vendor"
            eventId={id}
            eventStartAt={eventRecord.start_at}
          />
          <QuarterAuctionEventBanner eventId={id} variant="vendor" />
        </div>
      </div>

      {sortedLimits.length > 0 ? (
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Booth categories</h2>
          <ul className="space-y-2">
            {sortedLimits.map((cl: EventCategoryLimit) => (
              <li
                key={cl.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="font-medium">{cl.category?.name}</span>
                <span className="text-muted-foreground">
                  {formatCapacityRemaining(
                    capacity.slotsByCategoryId[cl.category_id] ?? 0,
                    capacity.maxSlotsByCategoryId[cl.category_id] ?? cl.max_slots
                  )}
                  {' · '}
                  {cl.price_per_booth > 0 ? formatCents(cl.price_per_booth) : 'Free'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <VendorEventVenueMap
        event={{
          id: eventRecord.id,
          name: eventRecord.name,
          latitude: eventRecord.latitude,
          longitude: eventRecord.longitude,
          status: eventRecord.status,
          location_name: eventRecord.location_name,
          address: eventRecord.address,
        }}
      />

      {!isQuarterAuction ? (
        <MarketApplicationLayoutView
          eventData={{
            id: eventRecord.id,
            name: eventRecord.name,
            status: eventRecord.status,
          }}
          layoutId={(layoutRow as BoothLayout | null)?.id ?? null}
          layout={(layoutRow as BoothLayout | null) ?? null}
          highlightBoothNumber={existingApp?.booth_number ?? null}
          className="rounded-2xl border bg-white p-6"
        />
      ) : null}

      <div id="your-application" className="scroll-mt-24 rounded-2xl border bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          {existingApp ? 'Your application' : 'Apply for this market'}
        </h2>
        {existingApp && coordinator ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-canvas px-4 py-3">
            <MarketOwnerLink
              owner={{
                id: coordinator.id,
                full_name: coordinator.full_name,
                avatar_url: coordinator.avatar_url,
              }}
              compact
            />
            <Link href="/vendor/applications">
              <Button size="sm" variant="outline" className="h-8 text-xs">
                All applications
              </Button>
            </Link>
          </div>
        ) : null}
        {isQuarterAuction ? (
          <p className="mb-4 text-sm text-muted-foreground">
            Vendor applications are required for this quarter auction. Apply, get approved, and pay any booth fee —
            there is no assigned floor-plan booth placement.
          </p>
        ) : null}
        {!passportReady ? (
          <div className="mb-4 rounded-xl border border-harvest-200 bg-harvest-50 p-4 text-sm text-harvest-800">
            <p className="flex items-start gap-2 font-medium">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Complete your Vendor Passport before applying
            </p>
            <p className="mt-1 text-harvest-800/90">
              Add your business name and at least one category so organizers can review your fit.
            </p>
            <Link href="/vendor/passport" className="mt-3 inline-block">
              <Button size="sm" variant="outline" className="border-harvest-400 bg-white">
                Set up passport
              </Button>
            </Link>
          </div>
        ) : null}
        {!existingApp && paidCategoryLimits.length > 0 ? (
          <div className="mb-4 rounded-lg bg-canvas p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Booth fee</span>
              <span className="font-semibold">
                {minBoothFee === maxBoothFee
                  ? formatCents(minBoothFee)
                  : `${formatCents(minBoothFee)} – ${formatCents(maxBoothFee)}`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              The total above is what gets charged to your card on application.
            </p>
          </div>
        ) : null}
        <VendorEventApplySection
          event={eventRecord as Event}
          userId={user.id}
          applicationStatus={existingApp?.status ?? null}
          applicationId={existingApp?.id ?? null}
          existingApplication={existingApp ?? null}
          boothPriceCents={boothPriceCents}
          applicationsOpen={applicationsOpen}
          vendorCanVouch={vendorCanVouch}
        />
      </div>

      <MarketFeedbackWidget marketId={id} />
    </div>
  )
}
