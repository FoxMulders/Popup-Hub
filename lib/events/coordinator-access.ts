import type { SupabaseClient } from '@supabase/supabase-js'
import { canActAsCoordinator, isPlatformAdmin } from '@/lib/auth/rbac'

export async function assertEventCoordinator(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', userId)
    .single()

  if (!canActAsCoordinator(profile)) {
    return { ok: false, status: 403, error: 'Coordinator access required' }
  }

  let query = supabase.from('events').select('id').eq('id', eventId)

  if (!isPlatformAdmin(profile)) {
    query = query.eq('coordinator_id', userId)
  }

  const { data: event } = await query.single()

  if (!event) {
    return { ok: false, status: 404, error: 'Event not found' }
  }

  return { ok: true }
}
