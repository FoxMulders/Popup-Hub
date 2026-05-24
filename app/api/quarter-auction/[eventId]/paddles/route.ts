import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/quarter-auction/catalog'
import { deductWalletCredits, nextPaddleNumber } from '@/lib/quarter-auction/wallet'

interface RouteParams {
  params: Promise<{ eventId: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
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

  if (!settings.enabled) {
    return NextResponse.json({ error: 'Quarter auction is not enabled for this event' }, { status: 422 })
  }

  const deduct = await deductWalletCredits(
    service,
    user.id,
    settings.paddle_purchase_credits,
    'paddle_purchase',
    { event_id: eventId, kind: 'virtual_paddle' }
  )

  if (!deduct.ok) {
    return NextResponse.json({ error: deduct.error }, { status: 402 })
  }

  const paddleNumber = await nextPaddleNumber(service, eventId)

  const { data: paddle, error } = await service
    .from('event_paddles')
    .insert({
      event_id: eventId,
      user_id: user.id,
      paddle_number: paddleNumber,
      purchase_credits: settings.paddle_purchase_credits,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 })
  }

  return NextResponse.json({ paddle, newBalance: deduct.newBalance })
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

  const { data: paddles } = await supabase
    .from('event_paddles')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .order('purchased_at', { ascending: true })

  return NextResponse.json({ paddles: paddles ?? [] })
}
