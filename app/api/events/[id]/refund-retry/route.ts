import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { retryRefundException } from '@/lib/events/retry-refund'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/events/[id]/refund-retry
 * Body: { exceptionId: string }
 */
export async function POST(request: Request, context: RouteContext) {
  const { id: eventId } = await context.params
  const body = await request.json() as { exceptionId?: string }
  const exceptionId = body.exceptionId

  if (!exceptionId) {
    return NextResponse.json({ error: 'exceptionId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('coordinator_id', user.id)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const service = await createServiceClient()
  const result = await retryRefundException(service, {
    exceptionId,
    coordinatorId: user.id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, refundId: result.refundId })
}
