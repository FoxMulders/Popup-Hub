import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isEventOpenForApplications,
  OPEN_EVENT_STATUSES,
} from '@/lib/queries/events'
import { fetchCategoryAvailableSlots } from '@/lib/queries/event-capacity'
import { isPassportReadyForApplication } from '@/lib/vendor/passport-application'
import type { Event, Role } from '@/types/database'

async function nextWaitlistPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  categoryId: string
) {
  const { data } = await supabase
    .from('booth_applications')
    .select('waitlist_position')
    .eq('event_id', eventId)
    .eq('category_id', categoryId)
    .eq('status', 'waitlisted')
    .order('waitlist_position', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.waitlist_position ?? 0) + 1
}

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
    joinWaitlist?: boolean
  }

  const { eventId, categoryId, neighborPreference, joinWaitlist } = body
  if (!eventId || !categoryId) {
    return NextResponse.json({ error: 'eventId and categoryId are required' }, { status: 400 })
  }

  const [{ data: passport }, { data: event }, { data: existing }] = await Promise.all([
    supabase
      .from('vendor_passports')
      .select('id, business_name, primary_category_id, category_ids, is_verified')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('events')
      .select('id, booking_mode, status, start_at, end_at, allow_mlm, listing_type')
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

  if ((event.listing_type ?? 'community_market') === 'garage_yard_sale') {
    return NextResponse.json(
      { error: 'Garage and yard sales do not accept vendor booth applications.' },
      { status: 400 }
    )
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

  const availableSlots = await fetchCategoryAvailableSlots(supabase, eventId, categoryId)
  const categoryIsFull = availableSlots <= 0

  if (categoryIsFull && !joinWaitlist) {
    return NextResponse.json(
      {
        error: 'This category is full. Confirm waitlist to be notified if a spot opens.',
        requiresWaitlist: true,
      },
      { status: 409 }
    )
  }

  const isInstant = event.booking_mode === 'instant'
  const boothPrice = categoryLimit.price_per_booth ?? 0
  const requiresPayment = boothPrice > 0

  let status: 'pending' | 'approved' | 'waitlisted' = 'pending'
  let paymentStatus: 'unpaid' | 'payment_required' = 'unpaid'
  let waitlistPosition: number | null = null
  const now = new Date().toISOString()

  if (categoryIsFull) {
    status = 'waitlisted'
    waitlistPosition = await nextWaitlistPosition(supabase, eventId, categoryId)
  } else if (isInstant) {
    status = 'approved'
    if (requiresPayment) paymentStatus = 'payment_required'
  }

  const { data: inserted, error } = await supabase
    .from('booth_applications')
    .insert({
      event_id: eventId,
      vendor_id: user.id,
      category_id: categoryId,
      status,
      payment_status: paymentStatus,
      neighbor_preference: neighborPreference?.trim() || null,
      waitlist_position: waitlistPosition,
      ...(status === 'approved' ? { approved_at: now } : {}),
    })
    .select('id, status, payment_status, waitlist_position')
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
    requiresPayment: requiresPayment && status === 'approved',
    boothPriceCents: boothPrice,
    waitlisted: status === 'waitlisted',
  })
}
