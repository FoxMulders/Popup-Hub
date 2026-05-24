import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolvePaymentFieldsForPaidApplication } from '@/lib/applications/payment-fields'
import type { ApplicationStatus, BoothApplication } from '@/types/database'

const ALLOWED_STATUSES: ApplicationStatus[] = [
  'approved',
  'rejected',
  'waitlisted',
  'pending',
]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { status?: ApplicationStatus }
  const newStatus = body.status

  if (!newStatus || !ALLOWED_STATUSES.includes(newStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data: application } = await supabase
    .from('booth_applications')
    .select(`
      id,
      event_id,
      vendor_id,
      category_id,
      status,
      payment_method,
      event:events(id, coordinator_id, status)
    `)
    .eq('id', applicationId)
    .single()

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const eventRow = Array.isArray(application.event)
    ? application.event[0]
    : application.event

  if (!eventRow || eventRow.coordinator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (eventRow.status === 'cancelled') {
    return NextResponse.json({ error: 'Event is cancelled' }, { status: 409 })
  }

  if (newStatus === 'approved' && application.category_id) {
    const { data: limit } = await supabase
      .from('event_category_limits')
      .select('max_slots, price_per_booth, category:categories(name)')
      .eq('event_id', application.event_id)
      .eq('category_id', application.category_id)
      .maybeSingle()

    if (limit) {
      const { count, error: countError } = await supabase
        .from('booth_applications')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', application.event_id)
        .eq('category_id', application.category_id)
        .eq('status', 'approved')
        .neq('id', applicationId)

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 500 })
      }

      const approvedInCategory = count ?? 0
      if (approvedInCategory >= limit.max_slots) {
        const category = Array.isArray(limit.category)
          ? limit.category[0]
          : limit.category
        const categoryName = category?.name ?? 'This category'
        return NextResponse.json(
          {
            error: `${categoryName} is full (${limit.max_slots} slots)`,
            code: 'category_full',
          },
          { status: 409 }
        )
      }
    }
  }

  const updates: Partial<BoothApplication> = { status: newStatus }

  if (newStatus === 'approved') {
    updates.approved_at = new Date().toISOString()

    const { data: limit } = await supabase
      .from('event_category_limits')
      .select('price_per_booth')
      .eq('event_id', application.event_id)
      .eq('category_id', application.category_id)
      .maybeSingle()

    const boothPrice = limit?.price_per_booth ?? 0
    if (boothPrice > 0) {
      const paymentFields = resolvePaymentFieldsForPaidApplication({
        paymentMethod: application.payment_method ?? 'SQUARE',
        requiresPayment: true,
        approved: true,
      })
      updates.payment_method = paymentFields.payment_method
      updates.payment_status = paymentFields.payment_status
      updates.application_payment_status = paymentFields.application_payment_status
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('booth_applications')
    .update(updates)
    .eq('id', applicationId)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    application: updated,
    updates,
  })
}
