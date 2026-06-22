import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function assertOrganizerClaimHolder(
  organizerSlug: string,
  userId: string
): Promise<
  | { ok: true; organizerId: string }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', userId)
    .single()

  if (!canActAsCoordinator(profile) && profile?.is_admin !== true) {
    return { ok: false, status: 403, error: 'Coordinator account required' }
  }

  const { data: organizer } = await supabase
    .from('organizers')
    .select('id, claimed_by, popup_hub_coordinator_id')
    .eq('slug', organizerSlug)
    .eq('listing_status', 'published')
    .maybeSingle()

  if (!organizer) {
    return { ok: false, status: 404, error: 'Organizer not found' }
  }

  const isClaimHolder =
    organizer.claimed_by === userId ||
    organizer.popup_hub_coordinator_id === userId ||
    profile?.is_admin === true

  if (!isClaimHolder) {
    return { ok: false, status: 403, error: 'Claim this organizer profile before responding' }
  }

  return { ok: true, organizerId: organizer.id }
}

export async function claimOrganizerProfile(
  organizerSlug: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', userId)
    .single()

  if (!canActAsCoordinator(profile)) {
    return {
      ok: false,
      status: 403,
      error: 'Sign up or switch to a coordinator account to claim this profile.',
    }
  }

  const { data: organizer } = await supabase
    .from('organizers')
    .select('id, claimed_by')
    .eq('slug', organizerSlug)
    .eq('listing_status', 'published')
    .maybeSingle()

  if (!organizer) {
    return { ok: false, status: 404, error: 'Organizer not found' }
  }

  if (organizer.claimed_by && organizer.claimed_by !== userId) {
    return { ok: false, status: 409, error: 'This profile has already been claimed.' }
  }

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('organizers')
    .update({
      claimed_by: userId,
      popup_hub_coordinator_id: userId,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizer.id)
    .or(`claimed_by.is.null,claimed_by.eq.${userId}`)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, error: error.message }
  }

  if (!updated) {
    return { ok: false, status: 409, error: 'This profile has already been claimed.' }
  }

  return { ok: true }
}
