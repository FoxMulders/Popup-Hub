import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Approved vendor booths at published/active markets — for Meet the Maker post creator. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: applications, error } = await supabase
    .from('booth_applications')
    .select(`
      event_id,
      event:events!inner(id, name, status)
    `)
    .eq('vendor_id', user.id)
    .eq('status', 'approved')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 })
  }

  const markets = (applications ?? [])
    .map((row) => {
      const event = Array.isArray(row.event) ? row.event[0] : row.event
      if (!event || !['published', 'active'].includes(event.status)) return null
      return {
        eventId: event.id as string,
        eventName: event.name as string,
      }
    })
    .filter((m): m is { eventId: string; eventName: string } => m !== null)

  const unique = [...new Map(markets.map((m) => [m.eventId, m])).values()]

  return NextResponse.json({ markets: unique })
}
