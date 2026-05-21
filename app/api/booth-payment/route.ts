import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createBoothPayment } from '@/lib/square/payments'

export async function POST(request: Request) {
  const supabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { sourceId, eventId, categoryId } = body

  if (!sourceId || !eventId || !categoryId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Get the price for this category/event
  const { data: limit } = await supabase
    .from('event_category_limits')
    .select('price_per_booth, events(coordinator_id, square_merchant_id)')
    .eq('event_id', eventId)
    .eq('category_id', categoryId)
    .single()

  if (!limit) {
    return NextResponse.json({ error: 'Category not found for this event' }, { status: 404 })
  }

  const amountCents = limit.price_per_booth as number
  if (amountCents <= 0) {
    // Free booth — no payment needed
    return NextResponse.json({ paymentId: null, free: true })
  }

  const platformFeeBps = Math.round(
    parseFloat(process.env.PLATFORM_FEE_PERCENT ?? '5') * 100
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventData = (limit as any).events
  const coordinatorMerchantId: string | null = eventData?.square_merchant_id ?? null

  // Create a placeholder application ID for idempotency (will be replaced on insert)
  const applicationRef = `${user.id}-${eventId}-${Date.now()}`

  const { paymentId, error } = await createBoothPayment({
    sourceId,
    amountCents,
    vendorId: user.id,
    eventId,
    applicationId: applicationRef,
    coordinatorMerchantId,
    platformFeeBps,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 402 })
  }

  return NextResponse.json({ paymentId })
}
