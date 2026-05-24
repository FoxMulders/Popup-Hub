import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')

  let query = supabase
    .from('wallet_withdrawal_requests')
    .select(`
      *,
      profiles ( id, full_name, email )
    `)
    .eq('method', 'etransfer')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (eventId) {
    query = query.eq('event_id', eventId)
  }

  const { data: pending, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pending: pending ?? [] })
}
