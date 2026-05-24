import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApplyButton } from '@/components/events/apply-button'
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
import { ArrowLeft, Calendar, Clock, MapPin, AlertTriangle } from 'lucide-react'
import { LiveAuctionBanner } from '@/components/auction/live-auction-banner'
import { QuarterAuctionEventBanner } from '@/components/quarter-auction/event-banner'
import { summarizeEventAuctions } from '@/lib/auction/event-auctions'
import { isPassportReadyForApplication } from '@/lib/vendor/passport-application'
import { computePlatformFeeCents } from '@/lib/monetization/fees'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import type { Auction, Event, EventCategoryLimit } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function VendorEventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: event }, { data: existingApp }, { data: eventAuctions }, { data: wallet }, { data: passport }] =
    await Promise.all([
    supabase
      .from('events')
      .select(VENDOR_EVENT_SELECT)
      .eq('id', id)
      .in('status', VENDOR_MARKET_STATUSES)
      .single(),
    supabase
      .from('booth_applications')
      .select('id, status, payment_status, payment_method, application_payment_status, category_id')
      .eq('event_id', id)
      .eq('vendor_id', user.id)
      .maybeSingle(),
    supabase
      .from('auctions')
      .select('*')
      .eq('event_id', id)
      .in('status', ['upcoming', 'active', 'ended'])
      .order('created_at', { ascending: false }),
    supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('vendor_passports')
      .select('business_name, primary_category_id, category_ids')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!event) notFound()

  const isQuarterAuctionListing =
    (event.listing_type ?? 'community_market') === 'garage_yard_sale'
  const capacity = await fetchEventCapacitySummary(supabase, event as Event)
  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator
  const displayStatus = getEventDisplayStatus(event, undefined, {
    isFullyBooked: capacity.isFullyBooked,
  })
  const applicationsOpen = isEventOpenForApplications(event)

  const sortedLimits = getVendorEligibleCategoryLimits(event as Event).sort(
    (a: EventCategoryLimit, b: EventCategoryLimit) =>
      (a.category?.name ?? '').localeCompare(b.category?.name ?? '')
  )
  const eventCapacityLabel = formatCapacityRemaining(capacity.totalAvailable, capacity.totalMaxSlots)
  const auctionSummary = summarizeEventAuctions((eventAuctions ?? []) as Auction[])
  const passportReady = isPassportReadyForApplication(passport)
  const boothPriceCents = existingApp?.category_id
    ? sortedLimits.find((cl) => cl.category_id === existingApp.category_id)?.price_per_booth ?? 0
    : 0
  const paidCategoryLimits = sortedLimits.filter((cl) => cl.price_per_booth > 0)
  const minBoothFee = paidCategoryLimits.length
    ? Math.min(...paidCategoryLimits.map((cl) => cl.price_per_booth))
    : 0
  const maxBoothFee = paidCategoryLimits.length
    ? Math.max(...paidCategoryLimits.map((cl) => cl.price_per_booth))
    : 0
  const sampleFeePreview =
    minBoothFee > 0 ? computePlatformFeeCents(minBoothFee, resolveEventFeeConfig(event as Event)) : 0

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
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.name} className="h-48 w-full object-contain bg-slate-50" />
        ) : (
          <div className="flex h-32 items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
            <MapPin className="h-12 w-12 text-amber-300" />
          </div>
        )}
        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <div className="flex flex-wrap gap-2">
              <Badge className="capitalize">
                {displayStatus === 'archived'
                  ? 'Archived'
                  : displayStatus === 'full'
                    ? 'Full'
                    : displayStatus}
              </Badge>
              <Badge className="capitalize">
                {event.booking_mode === 'juried' ? 'Juried review' : 'Instant book'}
              </Badge>
            </div>
          </div>
          {capacity.totalMaxSlots > 0 ? (
            <p className="text-sm font-medium text-gray-700">{eventCapacityLabel}</p>
          ) : null}
          {event.description ? <p className="text-sm text-gray-600">{event.description}</p> : null}
          <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-amber-500" />
              <span>{event.location_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-amber-500" />
              {format(new Date(event.start_at), 'EEE, MMM d, yyyy')}
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Clock className="h-4 w-4 shrink-0 text-amber-500" />
              {format(new Date(event.start_at), 'h:mm a')} – {format(new Date(event.end_at), 'h:mm a')}
            </div>
          </div>
          {coordinator ? (
            <div className="rounded-xl border bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Organizer</p>
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
          ) : null}
          <LiveAuctionBanner
            activeAuction={auctionSummary.active}
            upcomingAuction={auctionSummary.upcoming}
            lastEndedAuction={auctionSummary.lastEnded}
            walletBalanceCents={wallet?.balance ?? 0}
          />
          <QuarterAuctionEventBanner eventId={id} variant="vendor" />
        </div>
      </div>

      {sortedLimits.length > 0 ? (
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Booth categories</h2>
          <ul className="space-y-2">
            {sortedLimits.map((cl: EventCategoryLimit) => (
              <li
                key={cl.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="font-medium">{cl.category?.name}</span>
                <span className="text-gray-500">
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

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Apply for this market</h2>
        {isQuarterAuctionListing ? (
          <p className="text-sm text-muted-foreground">
            This is a quarter auction listing — vendor booth applications are not used for this event type.
          </p>
        ) : (
          <>
            {!passportReady ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="flex items-start gap-2 font-medium">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Complete your Vendor Passport before applying
                </p>
                <p className="mt-1 text-amber-900/90">
                  Add your business name and at least one category so organizers can review your fit.
                </p>
                <Link href="/profile/passport" className="mt-3 inline-block">
                  <Button size="sm" variant="outline" className="border-amber-300 bg-white">
                    Set up passport
                  </Button>
                </Link>
              </div>
            ) : null}
            {!existingApp && paidCategoryLimits.length > 0 ? (
              <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booth fee range</span>
                  <span className="font-semibold">
                    {minBoothFee === maxBoothFee
                      ? formatCents(minBoothFee)
                      : `${formatCents(minBoothFee)} – ${formatCents(maxBoothFee)}`}
                  </span>
                </div>
                {sampleFeePreview > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Platform fee (3% + $1) applies on paid booths — e.g. {formatCents(sampleFeePreview)} on{' '}
                    {formatCents(minBoothFee)}.
                  </p>
                ) : null}
              </div>
            ) : null}
            <ApplyButton
              event={event as Event}
              userId={user.id}
              applicationStatus={existingApp?.status ?? null}
              existingApplication={existingApp ?? null}
              boothPriceCents={boothPriceCents}
              applicationsOpen={applicationsOpen}
            />
          </>
        )}
      </div>

      <MarketFeedbackWidget marketId={id} />
    </div>
  )
}
