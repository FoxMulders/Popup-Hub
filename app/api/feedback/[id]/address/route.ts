import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assertEventCoordinator } from '@/lib/events/coordinator-access'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/feedback/[id]/address
 * Mark feedback as addressed and notify the reporting user.
 */
export async function PATCH(_request: Request, context: RouteContext) {
  const { id: feedbackId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: feedback } = await supabase
    .from('market_feedback')
    .select(`
      id,
      user_id,
      market_id,
      comment_text,
      is_addressed,
      market:events!market_feedback_market_id_fkey(id, name, coordinator_id)
    `)
    .eq('id', feedbackId)
    .maybeSingle()

  if (!feedback) {
    return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
  }

  const access = await assertEventCoordinator(supabase, feedback.market_id, user.id)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  if (feedback.is_addressed) {
    return NextResponse.json({ ok: true, already_addressed: true })
  }

  const { error: updateError } = await supabase
    .from('market_feedback')
    .update({ is_addressed: true })
    .eq('id', feedbackId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const market = Array.isArray(feedback.market) ? feedback.market[0] : feedback.market
  const marketName = market?.name ?? 'your market'
  const preview =
    feedback.comment_text.length > 120
      ? `${feedback.comment_text.slice(0, 117)}…`
      : feedback.comment_text

  const service = await createServiceClient()
  await service.from('notifications').insert({
    user_id: feedback.user_id,
    type: 'feedback_addressed',
    message: `Your feedback for ${marketName} has been addressed: "${preview}"`,
    metadata: {
      feedback_id: feedbackId,
      market_id: feedback.market_id,
      market_name: marketName,
    },
  })

  return NextResponse.json({ ok: true })
}
