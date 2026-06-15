import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { ApplicationBoard } from '@/components/coordinator/application-board'
import { EventInlineEditor } from '@/components/coordinator/event-inline-editor'
import { TestSuitePopulateButton } from '@/components/coordinator/test-suite-populate-button'
import { DeleteDraftMarketDialog } from '@/components/coordinator/delete-draft-market-dialog'
import { EventReadinessChecklist } from '@/components/coordinator/event-readiness-checklist'
import { MarketFeedbackAdminPanel } from '@/components/coordinator/market-feedback-admin-panel'
import { EventLogisticsEditor } from '@/components/coordinator/event-logistics-editor'
import { EventScheduleEditor } from '@/components/coordinator/event-schedule-editor'
import { RefundExceptionsPanel } from '@/components/coordinator/refund-exceptions-panel'
import { VendorAnnouncement } from '@/components/coordinator/vendor-announcement'
import { CategoryCapacityMatrix } from '@/components/coordinator/category-capacity-matrix'
import { AuctionCard } from '@/components/auction/auction-card'
import { buildCategoryCapacityRows } from '@/lib/coordinator/category-capacity-rows'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LayoutDashboard, ClipboardCheck, Printer, Gauge, Gavel } from 'lucide-react'
import { coordinatorStudioHref } from '@/lib/coordinator/coordinator-routes'
import { getCancellationReasonLabel } from '@/lib/coordinator/cancellation-reasons'
import { fetchCoordinatorEventApplications } from '@/lib/applications/fetch-coordinator-applications'
import { buildCategoryNameMap } from '@/lib/applications/display-categories'
import { isQuarterAuctionListing } from '@/lib/events/listing-type'
import type { BoothApplication, Event, EventCancellationReason, EventScheduleItem } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CoordinatorEventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scope = await getCoordinatorScope(supabase, user.id)

  const { data: event } = await applyCoordinatorEventScope(
    supabase
      .from('events')
      .select('*, category_limits:event_category_limits(*, category:categories(name))')
      .eq('id', id),
    user.id,
    scope.isAdmin
  ).single()

  if (!event) notFound()

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

  const [{ data: layoutRow }, { data: squareLinked }, { data: scheduleItems }, { data: revenueRows }, { data: eventAuctions }] = await Promise.all([
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
      .from('auctions')
      .select('id, title, item_name, status, pot_amount, winning_paddle_id')
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
  ])

  const hasSquare = !!event.square_merchant_id || !!squareLinked

  const pendingCount =
    applications?.filter((a) => a.status === 'pending' || a.status === 'pending_insurance')
      .length ?? 0
  const approvedCount = applications?.filter((a) => a.status === 'approved').length ?? 0
  const waitlistedCount = applications?.filter((a) => a.status === 'waitlisted').length ?? 0
  const applicationCount = applications?.length ?? 0
  const hasLayout = layoutRow != null

  const approvedVendorIds = (applications ?? [])
    .filter((a) => a.status === 'approved' && a.vendor_id)
    .map((a) => a.vendor_id)

  const isCancelled = event.status === 'cancelled'
  const isDraft = event.status === 'draft'
  const isQuarterAuction = isQuarterAuctionListing(event.listing_type)

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

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="market-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <EventInlineEditor event={event as Event} />
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <TestSuitePopulateButton eventId={id} compact />
            {isDraft ? (
              <DeleteDraftMarketDialog eventId={id} eventName={event.name} />
            ) : null}
            {!isCancelled && (
              <>
                <Link
                  href={coordinatorStudioHref(id)}
                  className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' gap-1.5'}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Blueprint Studio
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
                <VendorAnnouncement
                  eventId={id}
                  eventName={event.name}
                  approvedVendorIds={approvedVendorIds}
                />
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Pending Review', count: pendingCount, color: 'text-harvest-600' },
          { label: 'Approved', count: approvedCount, color: 'text-sage-700' },
          { label: 'Waitlisted', count: waitlistedCount, color: 'text-muted-foreground' },
          { label: 'Booth Revenue', count: eventRevenueFormatted, color: 'text-forest' },
        ].map(({ label, count, color }) => {
          const panel = (
            <>
              <p className={`font-heading text-2xl font-bold ${color}`}>{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </>
          )
          if (label === 'Pending Review' && pendingCount > 0) {
            return (
              <Link
                key={label}
                href={`/coordinator/events/${id}/applications`}
                className="market-panel rounded-xl p-4 text-center transition-colors hover:border-harvest-300 hover:bg-harvest-50/50"
              >
                {panel}
              </Link>
            )
          }
          return (
            <div key={label} className="market-panel rounded-xl p-4 text-center">
              {panel}
            </div>
          )
        })}
      </div>

      <EventReadinessChecklist
        eventId={id}
        event={event as Event & { category_limits?: import('@/types/database').EventCategoryLimit[] }}
        applicationCount={applicationCount}
        approvedCount={approvedCount}
        hasLayout={hasLayout}
        hasSquare={hasSquare}
        pendingCount={pendingCount}
        hasAuction={(eventAuctions ?? []).length > 0}
      />

      {!isCancelled && <MarketFeedbackAdminPanel marketId={id} variant="page" />}

      {!isCancelled && <EventLogisticsEditor event={event as Event} />}

      {!isCancelled && (
        <EventScheduleEditor
          event={event as Event}
          items={(scheduleItems ?? []) as EventScheduleItem[]}
        />
      )}

      {!isCancelled && isQuarterAuction && (
        <div className="market-panel p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="market-section-title">Quarter Auctions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Run digital quarter auctions during market day.
              </p>
            </div>
            <Link
              href={`/coordinator/events/${id}/auctions`}
              className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' gap-1.5'}
            >
              <Gavel className="h-4 w-4" />
              Manage auctions
            </Link>
          </div>
          {(eventAuctions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No auctions yet.{' '}
              <Link href={`/coordinator/auctions/new?eventId=${id}`} className="font-medium text-forest underline">
                Create one
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {(eventAuctions ?? []).slice(0, 5).map((a) => (
                <li key={a.id}>
                  <AuctionCard auction={a} eventId={id} href={`/coordinator/events/${id}/auctions`} />
                </li>
              ))}
            </ul>
          )}
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
          applications={applications}
          bookingMode={event.booking_mode}
          eventCancelled={isCancelled}
          categoryNameById={Object.fromEntries(categoryNameById)}
          categoryLimits={sortedCategoryLimits}
          marketInsuranceRequired={Boolean(event.market_insurance_required)}
        />
      </div>
    </div>
  )
}
