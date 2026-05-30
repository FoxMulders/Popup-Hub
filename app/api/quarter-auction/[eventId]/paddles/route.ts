import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/quarter-auction/catalog'
import { clampPoolSize, DEFAULT_PADDLE_POOL_SIZE } from '@/lib/quarter-auction/paddle-pool'
import {
  fetchTakenPaddleNumbers,
  purchaseEventPaddles,
} from '@/lib/quarter-auction/purchase-paddles'
import { assertAuctionParticipant } from '@/lib/quarter-auction/participation'

interface RouteParams {
  params: Promise<{ eventId: string }>
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

  const body = (await request.json()) as { paddle_numbers?: (string | number)[] }
  const rawNumbers = body.paddle_numbers

  if (!Array.isArray(rawNumbers) || rawNumbers.length === 0) {
    return NextResponse.json({ error: 'Select at least one paddle number' }, { status: 400 })
  }

  const service = await createServiceClient()
  const settings = await getOrCreateSettings(service, eventId)

  if (!settings.enabled) {
    return NextResponse.json({ error: 'Quarter auction is not enabled for this event' }, { status: 422 })
  }

  const participation = await assertAuctionParticipant(service, eventId, user.id)
  if (!participation.ok) {
    return NextResponse.json({ error: participation.error }, { status: participation.status })
  }

  const result = await purchaseEventPaddles(service, {
    eventId,
    userId: user.id,
    rawNumbers,
    creditsPerPaddle: settings.paddle_purchase_credits,
    poolSize: settings.paddle_pool_size ?? DEFAULT_PADDLE_POOL_SIZE,
  })

  if (!result.ok) {
    const status = result.error.includes('Insufficient') ? 402 : 409
    return NextResponse.json(
      { error: result.error, conflictNumbers: result.conflictNumbers },
      { status }
    )
  }

  return NextResponse.json({
    paddles: result.paddles,
    newBalance: result.newBalance,
  })
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()
  const settings = await getOrCreateSettings(service, eventId)
  const poolSize = clampPoolSize(settings.paddle_pool_size ?? DEFAULT_PADDLE_POOL_SIZE)

  const [{ data: paddles }, taken] = await Promise.all([
    supabase
      .from('event_paddles')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: true }),
    fetchTakenPaddleNumbers(service, eventId),
  ])

  return NextResponse.json({
    paddles: paddles ?? [],
    taken: [...taken],
    poolSize,
    paddlePurchaseCredits: settings.paddle_purchase_credits,
  })
}
