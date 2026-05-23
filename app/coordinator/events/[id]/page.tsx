import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ApplicationBoard } from '@/components/coordinator/application-board'
import { EventInlineEditor } from '@/components/coordinator/event-inline-editor'
import { EventReadinessChecklist } from '@/components/coordinator/event-readiness-checklist'
import { EventLogisticsEditor } from '@/components/coordinator/event-logistics-editor'
import { EventScheduleEditor } from '@/components/coordinator/event-schedule-editor'
import { RefundExceptionsPanel } from '@/components/coordinator/refund-exceptions-panel'
import { VendorAnnouncement } from '@/components/coordinator/vendor-announcement'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LayoutDashboard, ClipboardCheck, Printer, Gauge } from 'lucide-react'
import { getCancellationReasonLabel } from '@/lib/coordinator/cancellation-reasons'
import type { Event, EventCancellationReason, EventScheduleItem } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CoordinatorEventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('*, category_limits:event_category_limits(*, category:categories(name))')
    .eq('id', id)
    .eq('coordinator_id', user.id)
    .single()

  if (!event) notFound()

  const sortedCategoryLimits = [...(event.category_limits ?? [])].sort(
    (a: { category?: { name?: string } }, b: { category?: { name?: string } }) =>
      (a.category?.name ?? '').localeCompare(b.category?.name ?? '')
  )

  const { data: applications } = await supabase
    .from('booth_applications')
    .select(`
      *,
      vendor:profiles(id, full_name, email, phone, avatar_url),
      passport:vendor_passports(business_name, bio, logo_url, item_image_urls, is_verified, tax_id_encrypted),
      category:categories(name)
    `)
    .eq('event_id', id)
    .order('applied_at', { ascending: true })

  const [{ data: layoutRow }, { data: squareLinked }, { data: scheduleItems }, { data: revenueRows }] = await Promise.all([
    supabase.from('booth_layouts').select('id').eq('event_id', id).maybeSingle(),
    supabase
      .from('events')
      .select('id')
      .eq('coordinator_id', user.id)
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
  ])

  const hasSquare = !!event.square_merchant_id || !!squareLinked

  const pendingCount = applications?.filter((a) => a.status === 'pending').length ?? 0
  const approvedCount = applications?.filter((a) => a.status === 'approved').length ?? 0
  const waitlistedCount = applications?.filter((a) => a.status === 'waitlisted').length ?? 0
  const applicationCount = applications?.length ?? 0
  const hasLayout = layoutRow != null

  const approvedVendorIds = (applications ?? [])
    .filter((a) => a.status === 'approved' && a.vendor_id)
    .map((a) => a.vendor_id)

  const isCancelled = event.status === 'cancelled'

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

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="market-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <EventInlineEditor event={event as Event} />
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isCancelled && (
              <>
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
                <Link
                  href={`/coordinator/events/${id}/layout`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' gap-1.5'}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Layout
                </Link>
                <Link
                  href={`/coordinator/events/${id}/operations`}
                  className={buttonVariants({ size: 'sm' }) + ' gap-1.5 bg-sage-600 hover:bg-sage-700 text-white'}
                >
                  <Gauge className="h-4 w-4" />
                  Market Day Dashboard
                </Link>
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

        {sortedCategoryLimits.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sortedCategoryLimits.map((cl: { id: string; category?: { name: string }; max_slots: number; price_per_booth: number }) => (
              <Badge key={cl.id} variant="outline" className="text-xs">
                {cl.category?.name}: {cl.max_slots} slots
                {cl.price_per_booth > 0 ? ` · $${(cl.price_per_booth / 100).toFixed(2)}` : ' · Free'}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Pending Review', count: pendingCount, color: 'text-harvest-600' },
          { label: 'Approved', count: approvedCount, color: 'text-sage-700' },
          { label: 'Waitlisted', count: waitlistedCount, color: 'text-muted-foreground' },
          { label: 'Booth Revenue', count: eventRevenueFormatted, color: 'text-forest' },
        ].map(({ label, count, color }) => (
          <div key={label} className="market-panel rounded-xl p-4 text-center">
            <p className={`font-heading text-2xl font-bold ${color}`}>{count}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <EventReadinessChecklist
        eventId={id}
        event={event as Event & { category_limits?: import('@/types/database').EventCategoryLimit[] }}
        applicationCount={applicationCount}
        approvedCount={approvedCount}
        hasLayout={hasLayout}
        hasSquare={hasSquare}
        pendingCount={pendingCount}
      />

      {!isCancelled && <EventLogisticsEditor event={event as Event} />}

      {!isCancelled && (
        <EventScheduleEditor
          event={event as Event}
          items={(scheduleItems ?? []) as EventScheduleItem[]}
        />
      )}

      <div id="applications" className="scroll-mt-24">
        <h2 className="market-section-title mb-4">
          Applications ({applications?.length ?? 0})
        </h2>
        <ApplicationBoard
          applications={(applications as never[]) ?? []}
          bookingMode={event.booking_mode}
          eventCancelled={isCancelled}
          categoryLimits={sortedCategoryLimits as Array<{
            category_id: string
            max_slots: number
            price_per_booth: number
            category?: { name: string }
          }>}
        />
      </div>
    </div>
  )
}
