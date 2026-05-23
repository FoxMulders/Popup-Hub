import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertEventCoordinator } from '@/lib/events/coordinator-access'

/**
 * GET /api/feedback?market_id=...
 * Lists unaddressed feedback for a market (coordinator of that event only).
 *
 * POST /api/feedback
 * Body: { market_id, comment_text, context_type?, context_id? }
 * Submit feedback (authenticated users).
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const marketId = searchParams.get('market_id')
  if (!marketId) {
    return NextResponse.json({ error: 'market_id is required' }, { status: 400 })
  }

  const access = await assertEventCoordinator(supabase, marketId, user.id)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const { data: feedback, error } = await supabase
    .from('market_feedback')
    .select(`
      id,
      user_id,
      market_id,
      comment_text,
      is_addressed,
      context_type,
      context_id,
      created_at,
      reporter:profiles!market_feedback_user_id_fkey(full_name, email, role)
    `)
    .eq('market_id', marketId)
    .eq('is_addressed', false)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ feedback: feedback ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    market_id?: string
    comment_text?: string
    context_type?: string | null
    context_id?: string | null
  }

  const { market_id, comment_text, context_type, context_id } = body
  if (!market_id || !comment_text?.trim()) {
    return NextResponse.json({ error: 'market_id and comment_text are required' }, { status: 400 })
  }

  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', market_id)
    .maybeSingle()

  if (!event) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  const { data: row, error } = await supabase
    .from('market_feedback')
    .insert({
      user_id: user.id,
      market_id,
      comment_text: comment_text.trim(),
      is_addressed: false,
      context_type: context_type ?? null,
      context_id: context_id ?? null,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: row.id })
}
