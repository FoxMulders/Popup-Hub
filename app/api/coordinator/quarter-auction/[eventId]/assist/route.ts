import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { creditWalletDeposit } from '@/lib/wallet/credit-deposit'
import { getOrCreateSettings } from '@/lib/quarter-auction/catalog'
import { purchaseEventPaddles, fetchTakenPaddleNumbers } from '@/lib/quarter-auction/purchase-paddles'
import { registerStaffAssistedParticipation } from '@/lib/quarter-auction/participation'
import { placeCatalogBidEntries } from '@/lib/quarter-auction/place-catalog-bid'
import { lookupPatronById } from '@/lib/coordinator/patron-lookup'

interface RouteParams {
  params: Promise<{ eventId: string }>
}

type AssistAction = 'check_in' | 'purchase_paddles' | 'place_bid' | 'cash_top_up'

const MAX_PADDLES_PER_REQUEST = 20
const MAX_TOP_UP_CENTS = 500_000

async function assertEventCoordinator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  coordinatorId: string
) {
  const { data: event } = await supabase
    .from('events')
    .select('id, coordinator_id, latitude, longitude, status')
    .eq('id', eventId)
    .single()

  if (!event || event.coordinator_id !== coordinatorId) {
    return null
  }
  return event
}

async function ensureStaffCheckIn(
  admin: ReturnType<typeof createAdminClient>,
  event: { latitude: number; longitude: number },
  eventId: string,
  patronUserId: string
) {
  return registerStaffAssistedParticipation(admin, {
    eventId,
    userId: patronUserId,
    eventLat: event.latitude,
    eventLng: event.longitude,
  })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { eventId } = await params
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

  const event = await assertEventCoordinator(supabase, eventId, user.id)
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  let body: {
    patronUserId?: string
    action?: AssistAction
    paddle_numbers?: (string | number)[]
    paddle_ids?: string[]
    catalogItemId?: string
    amountCents?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const patronUserId = body.patronUserId?.trim()
  const action = body.action

  if (!patronUserId || !action) {
    return NextResponse.json({ error: 'patronUserId and action are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: patron } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', patronUserId)
    .maybeSingle()

  if (!patron) {
    return NextResponse.json({ error: 'Patron account not found' }, { status: 404 })
  }

  if (action === 'check_in') {
    const result = await ensureStaffCheckIn(admin, event, eventId, patronUserId)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      ok: true,
      participated: true,
      alreadyRegistered: result.alreadyRegistered,
    })
  }

  if (action === 'cash_top_up') {
    const amountCents = body.amountCents
    if (!amountCents || !Number.isInteger(amountCents) || amountCents < 100) {
      return NextResponse.json({ error: 'Minimum cash top-up is $1.00' }, { status: 400 })
    }
    if (amountCents > MAX_TOP_UP_CENTS) {
      return NextResponse.json({ error: 'Amount exceeds desk limit ($5,000)' }, { status: 400 })
    }

    const credit = await creditWalletDeposit(admin, {
      userId: patronUserId,
      amountCents,
      metadata: {
        method: 'cash_at_door',
        staff_id: user.id,
        event_id: eventId,
        staff_assisted: true,
      },
    })

    if (!credit.ok) {
      return NextResponse.json({ error: credit.error }, { status: 422 })
    }

    await admin.from('wallet_deposit_requests').insert({
      user_id: patronUserId,
      amount_cents: amountCents,
      method: 'cash_at_door',
      status: 'completed',
      event_id: eventId,
      confirmed_by: user.id,
      wallet_transaction_id: credit.transactionId,
      completed_at: new Date().toISOString(),
      metadata: { staff_id: user.id, staff_assisted: true },
    })

    return NextResponse.json({ ok: true, newBalance: credit.newBalance })
  }

  if (action === 'purchase_paddles') {
    const settings = await getOrCreateSettings(admin, eventId)
    if (!settings.enabled) {
      return NextResponse.json({ error: 'Quarter auction is not enabled' }, { status: 422 })
    }

    const participation = await ensureStaffCheckIn(admin, event, eventId, patronUserId)
    if (!participation.ok) {
      return NextResponse.json({ error: participation.error }, { status: participation.status })
    }

    const rawNumbers = body.paddle_numbers
    if (!Array.isArray(rawNumbers) || rawNumbers.length === 0) {
      return NextResponse.json({ error: 'Select at least one paddle number' }, { status: 400 })
    }
    if (rawNumbers.length > MAX_PADDLES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Assign at most ${MAX_PADDLES_PER_REQUEST} paddles at once` },
        { status: 400 }
      )
    }

    const purchase = await purchaseEventPaddles(admin, {
      eventId,
      userId: patronUserId,
      rawNumbers,
      creditsPerPaddle: settings.paddle_purchase_credits,
      poolSize: settings.paddle_pool_size ?? 100,
    })

    if (!purchase.ok) {
      const status = purchase.error.includes('Insufficient') ? 402 : 409
      return NextResponse.json(
        { error: purchase.error, conflictNumbers: purchase.conflictNumbers },
        { status }
      )
    }

    return NextResponse.json({
      ok: true,
      paddles: purchase.paddles,
      newBalance: purchase.newBalance,
    })
  }

  if (action === 'place_bid') {
    const catalogItemId = body.catalogItemId?.trim()
    const paddleIds = body.paddle_ids

    if (!catalogItemId) {
      return NextResponse.json({ error: 'catalogItemId is required' }, { status: 400 })
    }
    if (!paddleIds?.length) {
      return NextResponse.json({ error: 'Select at least one paddle' }, { status: 400 })
    }
    if (paddleIds.length > MAX_PADDLES_PER_REQUEST) {
      return NextResponse.json({ error: 'Too many paddles selected' }, { status: 400 })
    }

    const { data: catalogItem } = await admin
      .from('auction_catalog_items')
      .select('id, event_id, status')
      .eq('id', catalogItemId)
      .maybeSingle()

    if (!catalogItem || catalogItem.event_id !== eventId) {
      return NextResponse.json({ error: 'Item not found for this event' }, { status: 404 })
    }

    const participation = await ensureStaffCheckIn(admin, event, eventId, patronUserId)
    if (!participation.ok) {
      return NextResponse.json({ error: participation.error }, { status: participation.status })
    }

    const bid = await placeCatalogBidEntries(admin, {
      catalogItemId,
      userId: patronUserId,
      paddleIds,
      staffId: user.id,
    })

    if (!bid.ok) {
      return NextResponse.json({ error: bid.error }, { status: bid.status })
    }

    return NextResponse.json({
      ok: true,
      entries: bid.entries,
      newBalance: bid.newBalance,
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function GET(request: Request, { params }: RouteParams) {
  const { eventId } = await params
  const url = new URL(request.url)
  const patronUserId = url.searchParams.get('patronUserId')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event = await assertEventCoordinator(supabase, eventId, user.id)
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const taken = [...(await fetchTakenPaddleNumbers(admin, eventId))]

  if (!patronUserId) {
    return NextResponse.json({ taken })
  }

  const patron = await lookupPatronById(admin, patronUserId, eventId)

  return NextResponse.json({ patron, taken })
}
