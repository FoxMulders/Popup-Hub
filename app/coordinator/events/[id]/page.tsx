import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { formatCoordinatorOwnerLabel } from '@/lib/coordinator/coordinator-owner-label'
import { AdminReadOnlyMarketBanner } from '@/components/coordinator/admin-read-only-market-banner'
import { ApplicationBoard } from '@/components/coordinator/application-board'
import { EventInlineEditor } from '@/components/coordinator/event-inline-editor'
import { TestSuitePopulateButton } from '@/components/coordinator/test-suite-populate-button'
import { DeleteDraftMarketDialog } from '@/components/coordinator/delete-draft-market-dialog'
import { EventHubTimeline } from '@/components/coordinator/event-hub-timeline'
import { CloneMarketButton } from '@/components/coordinator/clone-market-button'
import { SaveVenuePrompt } from '@/components/coordinator/save-venue-prompt'
import { listCoordinatorSavedVenues } from '@/lib/coordinator/saved-venues'
import { MarketFeedbackAdminPanel } from '@/components/coordinator/market-feedback-admin-panel'
import { EventLogisticsEditor } from '@/components/coordinator/event-logistics-editor'
import { EventScheduleEditor } from '@/components/coordinator/event-schedule-editor'
import { RefundExceptionsPanel } from '@/components/coordinator/refund-exceptions-panel'
import { VendorAnnouncement } from '@/components/coordinator/vendor-announcement'
import { CategoryCapacityMatrix } from '@/components/coordinator/category-capacity-matrix'
import { buildCategoryCapacityRows } from '@/lib/coordinator/category-capacity-rows'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LayoutDashboard, ClipboardCheck, Printer, Gauge, Gavel } from 'lucide-react'
import { coordinatorStudioHref } from '@/lib/coordinator/coordinator-routes'
import { getCancellationReasonLabel } from '@/lib/coordinator/cancellation-reasons'
import { fetchCoordinatorEventApplications } from '@/lib/applications/fetch-coordinator-applications'
import { buildCategoryNameMap } from '@/lib/applications/display-categories'
import { isQuarterAuctionListing } from '@/lib/events/listing-type'
import { EventHubLayoutNotice } from '@/components/coordinator/event-hub-layout-notice'
import { EventPaymentDeadlineEditor } from '@/components/coordinator/event-payment-deadline-editor'
import { OutstandingPaymentsPanel } from '@/components/coordinator/outstanding-payments-panel'
import { PendingEtransferPanel } from '@/components/coordinator/pending-etransfer-panel'
import { fetchEventOutstandingPayments } from '@/lib/applications/fetch-event-outstanding-payments'
import { Suspense } from 'react'
import type { Event, EventCancellationReason, EventScheduleItem } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CoordinatorEventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scope = await getCoordinatorScope(supabase, user.id)

  const { data: event, error: eventLoadError } = await applyCoordinatorEventScope(
    supabase
      .from('events')
      .select('*, category_limits:event_category_limits(*, category:categories(name))')
      .eq('id', id),
    user.id,
    scope.isAdmin
  ).single()

  if (eventLoadError) {
    console.error('[coordinator/event hub] event query failed', eventLoadError.message)
  }
  if (!event) notFound()

  const isEventOwner = event.coordinator_id === user.id
  const readOnlyAdminView = scope.isAdmin && !isEventOwner
  let ownerName: string | null = null
  if (readOnlyAdminView) {
    const { data: owner } = await supabase
      .from('profiles')
      .select('full_name, coordinator_organization_name, email')
      .eq('id', event.coordinator_id)
      .maybeSingle()
    ownerName = formatCoordinatorOwnerLabel(owner)
  }

  const sortedCategoryLimits = [...(event.category_limits ?? [])].sort(
    (a: { category?: { name?: string } }, b: { category?: { name?: string } }) =>
      (a.category?.name ?? '').localeCompare(b.category?.name ?? '')
  )

  const [{ applications, error: applicationsLoadError }, { data: allCategories }] =
    await Promise.all([
      fetchCoordinatorEventApplications(supabase, id),
      supabase.from('categories').select('id, name'),
    ])

  const categoryNameById = buildCategoryNameMap(allCategories ?? [])

  const [{ data: layoutRow }, { data: squareLinked }, { data: scheduleItems }, { data: revenueRows }, { count: catalogItemCount }, { count: qaVendorApprovalCount }] = await Promise.all([
    supabase.from('booth_layouts').select('id').eq('event_id', id).maybeSingle(),
    supabase
      .from('events')
      .select('id')
      .eq('coordinator_id', event.coordinator_id)
      .not('square_merchant_id', 'is', null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('event_schedule_items')
      .select('*')
      .eq('event_id', id)
      .order('starts_at', { ascending: true }),
    supabase
      .from('platform_transactions')
      .select('organizer_payout_amount')
      .eq('event_id', id)
      .eq('status', 'completed'),
    supabase
      .from('auction_catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id),
    supabase
      .from('quarter_auction_vendor_approvals')
      .select('vendor_id', { count: 'exact', head: true })
      .eq('event_id', id),
  ])

  const hasSquare = !!event.square_merchant_id || !!squareLinked

  const pendingCount =
    applications?.filter((a) => a.status === 'pending' || a.status === 'pending_insurance')
      .length ?? 0
  const approvedCount = applications?.filter((a) => a.status === 'approved').length ?? 0
  const waitlistedCount = applications?.filter((a) => a.status === 'waitlisted').length ?? 0
  const applicationCount = applications?.length ?? 0
  const hasLayout = layoutRow != null
  const assignedBoothCount =
    applications?.filter(
      (a) =>
        (a.status === 'approved' || a.status === 'pending_insurance') &&
        a.booth_number != null
    ).length ?? 0

  const approvedVendorIds = (applications ?? [])
    .filter((a) => a.status === 'approved' && a.vendor_id)
    .map((a) => a.vendor_id)

  const isCancelled = event.status === 'cancelled'
  const isDraft = event.status === 'draft'
  const isQuarterAuction = isQuarterAuctionListing(event.listing_type)
  const quarterAuctionCatalogReady =
    (catalogItemCount ?? 0) > 0 || (qaVendorApprovalCount ?? 0) > 0

  const eventRevenueCents =
    revenueRows?.reduce((sum, row) => sum + (row.organizer_payout_amount ?? 0), 0) ?? 0
  const eventRevenueFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(eventRevenueCents / 100)

  const { data: refundExceptions } = isCancelled
    ? await supabase
        .from('refund_exceptions')
        .select('id, booth_application_id, square_payment_id, amount_cents, error_message, retry_count')
        .eq('event_id', id)
        .eq('status', 'pending_retry')
        .order('created_at', { ascending: true })
    : { data: [] }

  const categoryCapacityRows = buildCategoryCapacityRows(sortedCategoryLimits, applications ?? [])

  const outstandingPayments = !isCancelled
    ? await fetchEventOutstandingPayments(
        supabase,
        id,
        sortedCategoryLimits,
        {
          listing_type: event.listing_type,
          booth_price_cents: event.booth_price_cents,
          multi_table_discount_percent: event.multi_table_discount_percent,
        }
      )
    : { digital: [], offline: [], overdueCount: 0 }

  const { venues: savedVenues } = await listCoordinatorSavedVenues(supabase, event.coordinator_id)
  const venueAlreadySaved = savedVenues.some(
    (venue) =>
      venue.location_name.trim().toLowerCase() === event.location_name.trim().toLowerCase() &&
      venue.address.trim().toLowerCase() === event.address.trim().toLowerCase()
  )

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <Suspense fallback={null}>
        <EventHubLayoutNotice />
      </Suspense>

      {readOnlyAdminView && ownerName ? (
        <AdminReadOnlyMarketBanner ownerName={ownerName} />
      ) : null}

      {!isCancelled ? (
        <div className="sticky top-16 z-20">
          <EventHubTimeline
            eventId={id}
            event={event as Event & { category_limits?: import('@/types/database').EventCategoryLimit[] }}
            applicationCount={applicationCount}
            approvedCount={approvedCount}
            pendingCount={pendingCount}
            waitlistedCount={waitlistedCount}
            assignedBoothCount={assignedBoothCount}
            hasLayout={hasLayout}
            hasSquare={hasSquare}
            quarterAuctionCatalogReady={quarterAuctionCatalogReady}
            eventRevenueFormatted={eventRevenueFormatted}
            isCancelled={isCancelled}
          />
        </div>
      ) : null}

      <div className="market-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          {readOnlyAdminView ? (
            <div>
              <h1 className="text-2xl font-bold text-foreground">{event.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Read-only admin inspection</p>
            </div>
          ) : (
            <EventInlineEditor event={event as Event} />
          )}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!readOnlyAdminView ? (
              <TestSuitePopulateButton eventId={id} compact />
            ) : null}
            {isDraft && !readOnlyAdminView ? (
              <DeleteDraftMarketDialog eventId={id} eventName={event.name} />
            ) : null}
            {!isCancelled && !isDraft && !readOnlyAdminView ? (
              <CloneMarketButton eventId={id} />
            ) : null}
            {!isCancelled && (
              <>
                <Link
                  href={coordinatorStudioHref(id)}
                  className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' gap-1.5'}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  HubGrid
                </Link>
                <Link
                  href={`/coordinator/events/${id}/checkin`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' gap-1.5'}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Check-In
                </Link>
                <Link
                  href={`/coordinator/events/${id}/print`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' gap-1.5'}
                >
                  <Printer className="h-4 w-4" />
                  Print Roster
                </Link>
                {!readOnlyAdminView ? (
                  <VendorAnnouncement
                    eventId={id}
                    eventName={event.name}
                    approvedVendorIds={approvedVendorIds}
                  />
                ) : null}
                {!event.skip_venue_layout ? (
                  <Link
                    href={`/coordinator/events/${id}/layout`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' gap-1.5'}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Layout
                  </Link>
                ) : null}
                <Link
                  href={`/coordinator/events/${id}/operations`}
                  className={buttonVariants({ size: 'sm' }) + ' gap-1.5 bg-sage-600 hover:bg-sage-700 text-white'}
                >
                  <Gauge className="h-4 w-4" />
                  Market Day Dashboard
                </Link>
                {isQuarterAuction ? (
                  <Link
                    href={`/coordinator/events/${id}/auctions`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' gap-1.5'}
                  >
                    <Gavel className="h-4 w-4" />
                    Auctions
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        {isCancelled && (
          <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3">
            <p className="font-bold text-red-800">This event has been cancelled</p>
            <p className="mt-1 text-sm text-red-700">
              Editing is disabled. Paid vendors have been refunded via Square where possible.
            </p>
            {(event as Event).cancellation_reason && (
              <p className="mt-2 text-sm text-red-800">
                <span className="font-semibold">Recorded reason:</span>{' '}
                {getCancellationReasonLabel(
                  (event as Event).cancellation_reason as EventCancellationReason,
                  (event as Event).cancellation_reason_notes
                )}
                {(event as Event).cancellation_penalty_applied > 0
                  ? ` · Reliability penalty: −${(event as Event).cancellation_penalty_applied} pts`
                  : ''}
              </p>
            )}
          </div>
        )}

        {refundExceptions && refundExceptions.length > 0 && (
          <RefundExceptionsPanel eventId={id} exceptions={refundExceptions} />
        )}

        {categoryCapacityRows.length > 0 && (
          <CategoryCapacityMatrix rows={categoryCapacityRows} applications={applications ?? []} />
        )}

        {!isCancelled && !readOnlyAdminView ? (
          <EventPaymentDeadlineEditor event={event as Event} disabled={isCancelled} />
        ) : null}

        {!isCancelled && outstandingPayments.overdueCount > 0 ? (
          <div className="mt-4 rounded-lg border border-terracotta-200 bg-terracotta-50/80 px-4 py-3 text-sm text-terracotta-900">
            <strong>{outstandingPayments.overdueCount}</strong> vendor
            {outstandingPayments.overdueCount === 1 ? '' : 's'} past the payment deadline — booths
            may auto-release on the next chase run unless you extend or confirm payment.
          </div>
        ) : null}

        {!isCancelled ? (
          <div className="mt-4 space-y-4">
            <OutstandingPaymentsPanel applications={outstandingPayments.digital} />
            <PendingEtransferPanel applications={outstandingPayments.offline} />
          </div>
        ) : null}

        {!isCancelled && !readOnlyAdminView ? (
          <div className="mt-4">
            <SaveVenuePrompt
            coordinatorId={event.coordinator_id}
            locationName={event.location_name}
            address={event.address}
            latitude={event.latitude}
            longitude={event.longitude}
            marketCity={event.market_city ?? 'edmonton'}
            skipVenueLayout={Boolean(event.skip_venue_layout)}
            initiallySaved={venueAlreadySaved}
            />
          </div>
        ) : null}
      </div>

      {!isCancelled && <MarketFeedbackAdminPanel marketId={id} variant="page" />}

      {!isCancelled && !readOnlyAdminView ? <EventLogisticsEditor event={event as Event} /> : null}

      {!isCancelled && !readOnlyAdminView ? (
        <EventScheduleEditor
          event={event as Event}
          items={(scheduleItems ?? []) as EventScheduleItem[]}
        />
      ) : null}

      {!isCancelled && isQuarterAuction && (
        <div className="market-panel p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="market-section-title">Auction control</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Approve vendors, build the catalog, and run the live quarter auction. Bid amounts are
                set per item when each vendor is on stage.
              </p>
            </div>
            <Link
              href={`/coordinator/events/${id}/auctions`}
              className={buttonVariants({ variant: 'default', size: 'sm' }) + ' gap-1.5'}
            >
              <Gavel className="h-4 w-4" />
              Open auction control
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            {(catalogItemCount ?? 0) > 0 ? (
              <>
                <strong className="text-foreground">{catalogItemCount}</strong> catalog item
                {(catalogItemCount ?? 0) === 1 ? '' : 's'}
                {(qaVendorApprovalCount ?? 0) > 0 ? (
                  <>
                    {' '}
                    · <strong className="text-foreground">{qaVendorApprovalCount}</strong> vendor
                    {(qaVendorApprovalCount ?? 0) === 1 ? '' : 's'} approved for auction
                  </>
                ) : null}
              </>
            ) : (qaVendorApprovalCount ?? 0) > 0 ? (
              <>
                <strong className="text-foreground">{qaVendorApprovalCount}</strong> vendor
                {(qaVendorApprovalCount ?? 0) === 1 ? '' : 's'} approved — add catalog items to get
                started.
              </>
            ) : (
              <>
                No catalog items yet.{' '}
                <Link
                  href={`/coordinator/events/${id}/auctions`}
                  className="font-medium text-forest underline"
                >
                  Set up the auction
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      <div id="applications" className="scroll-mt-24">
        <h2 className="market-section-title mb-4">
          Applications ({applications?.length ?? 0})
        </h2>
        {applicationsLoadError ? (
          <div
            className="mb-4 rounded-xl border border-terracotta-200 bg-terracotta-50 px-4 py-3 text-sm text-terracotta-900"
            role="alert"
          >
            Some vendor profile data could not be loaded ({applicationsLoadError}). Applications
            below may show limited details — refresh after updating database policies.
          </div>
        ) : null}
        <ApplicationBoard
          applications={applications ?? []}
          bookingMode={event.booking_mode}
          eventId={id}
          eventName={event.name}
          eventStatus={event.status}
          eventCancelled={isCancelled}
          categoryNameById={Object.fromEntries(categoryNameById)}
          categoryLimits={sortedCategoryLimits}
          marketInsuranceRequired={Boolean(event.market_insurance_required)}
        />
      </div>
    </div>
  )
}
