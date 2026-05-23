import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isEventOpenForApplications,
  OPEN_EVENT_STATUSES,
} from '@/lib/queries/events'
import { isPassportReadyForApplication } from '@/lib/vendor/passport-application'
import type { Event, Role } from '@/types/database'

export async function POST(request: Request) {
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

  if ((profile?.role as Role | undefined) !== 'vendor') {
    return NextResponse.json({ error: 'Vendor account required' }, { status: 403 })
  }

  const body = (await request.json()) as {
    eventId?: string
    categoryId?: string
    neighborPreference?: string | null
  }

  const { eventId, categoryId, neighborPreference } = body
  if (!eventId || !categoryId) {
    return NextResponse.json({ error: 'eventId and categoryId are required' }, { status: 400 })
  }

  const [{ data: passport }, { data: event }, { data: existing }] = await Promise.all([
    supabase
      .from('vendor_passports')
      .select('id, business_name, primary_category_id, is_verified')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('events')
      .select('id, booking_mode, status, start_at, end_at, allow_mlm')
      .eq('id', eventId)
      .maybeSingle(),
    supabase
      .from('booth_applications')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('vendor_id', user.id)
      .maybeSingle(),
  ])

  if (!isPassportReadyForApplication(passport)) {
    return NextResponse.json(
      { error: 'Complete your Vendor Passport before applying to markets.' },
      { status: 400 }
    )
  }

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (!OPEN_EVENT_STATUSES.includes(event.status as (typeof OPEN_EVENT_STATUSES)[number])) {
    return NextResponse.json({ error: 'This market is not open for applications' }, { status: 400 })
  }

  if (!isEventOpenForApplications(event as Event)) {
    return NextResponse.json({ error: 'Applications are closed for this market' }, { status: 400 })
  }

  if (existing) {
    return NextResponse.json(
      {
        error: 'You have already applied to this event',
        application: { id: existing.id, status: existing.status },
      },
      { status: 409 }
    )
  }

  const { data: categoryLimit } = await supabase
    .from('event_category_limits')
    .select('price_per_booth, category:categories(is_mlm)')
    .eq('event_id', eventId)
    .eq('category_id', categoryId)
    .maybeSingle()

  if (!categoryLimit) {
    return NextResponse.json({ error: 'Invalid category for this market' }, { status: 400 })
  }

  const category = Array.isArray(categoryLimit.category)
    ? categoryLimit.category[0]
    : categoryLimit.category

  if (category?.is_mlm && !event.allow_mlm) {
    return NextResponse.json({ error: 'This category is not available for this market' }, { status: 400 })
  }

  const isInstant = event.booking_mode === 'instant'
  const boothPrice = categoryLimit.price_per_booth ?? 0
  const requiresPayment = boothPrice > 0
  const paymentStatus = requiresPayment && isInstant ? 'payment_required' : 'unpaid'
  const now = new Date().toISOString()

  const { data: inserted, error } = await supabase
    .from('booth_applications')
    .insert({
      event_id: eventId,
      vendor_id: user.id,
      category_id: categoryId,
      status: isInstant ? 'approved' : 'pending',
      payment_status: paymentStatus,
      neighbor_preference: neighborPreference?.trim() || null,
      ...(isInstant ? { approved_at: now } : {}),
    })
    .select('id, status, payment_status')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already applied to this event' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    application: inserted,
    requiresPayment: requiresPayment && isInstant,
    boothPriceCents: boothPrice,
  })
}
