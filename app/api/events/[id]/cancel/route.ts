import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { cancelEventWithRefunds } from '@/lib/events/cancel-event'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/events/[id]/cancel
 * Coordinator-only: refunds paid vendors via Square and cancels the event.
 */
export async function POST(request: Request, context: RouteContext) {
  const { id: eventId } = await context.params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  const body = await request.json() as {
    cancellationReason?: string
    cancellationReasonNotes?: string | null
  }

  if (!body.cancellationReason) {
    return NextResponse.json({ error: 'cancellationReason is required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const result = await cancelEventWithRefunds(service, {
    eventId,
    coordinatorId: user.id,
    cancellationReason: body.cancellationReason,
    cancellationReasonNotes: body.cancellationReasonNotes,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    refundsAttempted: result.refundsAttempted,
    refundsSucceeded: result.refundsSucceeded,
    refundsFailed: result.refundsFailed,
    vendorsNotified: result.vendorsNotified,
    reliabilityPenalty: result.reliabilityPenalty,
    isLateCancellation: result.isLateCancellation,
    newReliabilityScore: result.newReliabilityScore,
  })
}
