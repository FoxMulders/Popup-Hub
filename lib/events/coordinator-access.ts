import type { SupabaseClient } from '@supabase/supabase-js'

export async function assertEventCoordinator(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role !== 'coordinator') {
    return { ok: false, status: 403, error: 'Coordinator access required' }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('coordinator_id', userId)
    .single()

  if (!event) {
    return { ok: false, status: 404, error: 'Event not found' }
  }

  return { ok: true }
}
