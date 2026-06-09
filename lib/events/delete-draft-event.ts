import type { SupabaseClient } from '@supabase/supabase-js'

export type DeleteDraftEventResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

export async function deleteDraftEvent(
  supabase: SupabaseClient,
  input: { eventId: string; coordinatorId: string; isAdmin?: boolean }
): Promise<DeleteDraftEventResult> {
  let fetchQuery = supabase
    .from('events')
    .select('id, status, coordinator_id, cover_image_url')
    .eq('id', input.eventId)

  if (!input.isAdmin) {
    fetchQuery = fetchQuery.eq('coordinator_id', input.coordinatorId)
  }

  const { data: event, error: fetchError } = await fetchQuery.maybeSingle()

  if (fetchError) {
    return { ok: false, error: fetchError.message, status: 500 }
  }

  if (!event) {
    return { ok: false, error: 'Event not found', status: 404 }
  }

  if (event.status !== 'draft') {
    return {
      ok: false,
      error: 'Only draft markets can be deleted. Cancel published events instead.',
      status: 400,
    }
  }

  const { count: applicationCount, error: appCountError } = await supabase
    .from('booth_applications')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', input.eventId)

  if (appCountError) {
    return { ok: false, error: appCountError.message, status: 500 }
  }

  if ((applicationCount ?? 0) > 0) {
    return {
      ok: false,
      error: 'This draft has vendor applications. Remove applications before deleting, or keep editing the market.',
      status: 409,
    }
  }

  if (event.cover_image_url) {
    const marker = '/event-covers/'
    const idx = event.cover_image_url.indexOf(marker)
    if (idx >= 0) {
      const storagePath = event.cover_image_url.slice(idx + marker.length).split('?')[0]
      if (storagePath) {
        await supabase.storage.from('event-covers').remove([storagePath])
      }
    }
  }

  let deleteQuery = supabase.from('events').delete().eq('id', input.eventId).eq('status', 'draft')

  if (!input.isAdmin) {
    deleteQuery = deleteQuery.eq('coordinator_id', input.coordinatorId)
  }

  const { error: deleteError } = await deleteQuery

  if (deleteError) {
    return { ok: false, error: deleteError.message, status: 500 }
  }

  return { ok: true }
}
