import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolvePaymentFieldsForPaidApplication } from '@/lib/applications/payment-fields'
import { isFullyApprovedStatus } from '@/lib/applications/resolve-approval-status'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const { applicationId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { marketInsuranceUrl?: string }
  const marketInsuranceUrl = body.marketInsuranceUrl?.trim()

  if (!marketInsuranceUrl) {
    return NextResponse.json({ error: 'marketInsuranceUrl is required' }, { status: 400 })
  }

  const { data: application } = await supabase
    .from('booth_applications')
    .select(`
      id,
      vendor_id,
      event_id,
      category_id,
      status,
      payment_method,
      payment_status,
      application_payment_status,
      event:events(id, name, coordinator_id, market_insurance_required)
    `)
    .eq('id', applicationId)
    .single()

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (application.vendor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (application.status !== 'pending_insurance') {
    return NextResponse.json(
      { error: 'Insurance proof is only required for applications pending insurance verification.' },
      { status: 409 },
    )
  }

  const eventRow = Array.isArray(application.event) ? application.event[0] : application.event
  if (!eventRow?.market_insurance_required) {
    return NextResponse.json({ error: 'This market does not require insurance proof.' }, { status: 409 })
  }

  const { data: limit } = await supabase
    .from('event_category_limits')
    .select('price_per_booth')
    .eq('event_id', application.event_id)
    .eq('category_id', application.category_id)
    .maybeSingle()

  const boothPrice = limit?.price_per_booth ?? 0
  /*
   * Don't regress payment fields if the payment is already cleared.
   * E-Transfer apps reach `pending_insurance` only after the
   * coordinator clicked "Mark as Paid & Approve" (confirm-etransfer
   * route) — at that point application_payment_status is COMPLETED.
   * Re-running resolvePaymentFieldsForPaidApplication here would
   * stomp those fields back to PENDING_REVIEW.
   */
  const paymentAlreadyCleared =
    application.payment_status === 'paid' ||
    application.application_payment_status === 'COMPLETED'
  const paymentFields =
    boothPrice > 0 && !paymentAlreadyCleared
      ? resolvePaymentFieldsForPaidApplication({
          paymentMethod: application.payment_method ?? 'SQUARE',
          requiresPayment: true,
          approved: true,
        })
      : null

  const now = new Date().toISOString()

  const { data: updated, error: updateError } = await supabase
    .from('booth_applications')
    .update({
      market_insurance_url: marketInsuranceUrl,
      status: 'approved',
      approved_at: now,
      ...(paymentFields ?? {}),
    })
    .eq('id', applicationId)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (isFullyApprovedStatus(updated.status) && eventRow?.coordinator_id) {
    const serviceSupabase = await createServiceClient()
    await serviceSupabase.from('notifications').insert({
      user_id: eventRow.coordinator_id,
      type: 'application_approved',
      message: `A vendor uploaded market insurance proof for "${eventRow.name ?? 'your market'}". Their booth is now fully approved.`,
      metadata: {
        event_id: application.event_id,
        application_id: applicationId,
        vendor_id: user.id,
      },
    })
  }

  return NextResponse.json({ ok: true, application: updated })
}
