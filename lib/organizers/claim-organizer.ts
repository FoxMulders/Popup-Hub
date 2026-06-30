import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { validateOrganizerClaimVerificationNote } from '@/lib/organizers/claim-verification'

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

export type OrganizerClaimSubmitResult =
  | { ok: true; status: 'pending' }
  | { ok: false; status: number; error: string }

/** Submit a claim for admin review — does not set claimed_by until approved. */
export async function submitOrganizerClaimRequest(
  organizerSlug: string,
  userId: string,
  verificationNote?: string | null
): Promise<OrganizerClaimSubmitResult> {
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
    .select('id, claimed_by, display_name')
    .eq('slug', organizerSlug)
    .eq('listing_status', 'published')
    .maybeSingle()

  if (!organizer) {
    return { ok: false, status: 404, error: 'Organizer not found' }
  }

  if (organizer.claimed_by && organizer.claimed_by !== userId) {
    return { ok: false, status: 409, error: 'This profile has already been claimed.' }
  }

  if (organizer.claimed_by === userId) {
    return { ok: true, status: 'pending' }
  }

  const noteCheck = validateOrganizerClaimVerificationNote(verificationNote)
  if (!noteCheck.ok) {
    return { ok: false, status: 400, error: noteCheck.error }
  }

  const { data: existingPending } = await supabase
    .from('organizer_claim_requests')
    .select('id')
    .eq('organizer_id', organizer.id)
    .eq('requested_by', userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingPending) {
    return { ok: true, status: 'pending' }
  }

  const { error } = await supabase.from('organizer_claim_requests').insert({
    organizer_id: organizer.id,
    requested_by: userId,
    status: 'pending',
    verification_note: verificationNote?.trim() || null,
  })

  if (error) {
    return { ok: false, status: 500, error: error.message }
  }

  return { ok: true, status: 'pending' }
}

/** @deprecated Instant claim — use submitOrganizerClaimRequest + admin approval. */
export async function claimOrganizerProfile(
  organizerSlug: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const result = await submitOrganizerClaimRequest(organizerSlug, userId)
  if (!result.ok) return result
  return { ok: true }
}

export async function getPendingOrganizerClaimForUser(
  organizerId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizer_claim_requests')
    .select('id')
    .eq('organizer_id', organizerId)
    .eq('requested_by', userId)
    .eq('status', 'pending')
    .maybeSingle()
  return Boolean(data)
}

export async function approveOrganizerClaimRequest(
  requestId: string,
  adminUserId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const admin = createAdminClient()

  const { data: request } = await admin
    .from('organizer_claim_requests')
    .select('id, organizer_id, requested_by, status')
    .eq('id', requestId)
    .maybeSingle()

  if (!request) {
    return { ok: false, status: 404, error: 'Claim request not found' }
  }
  if (request.status !== 'pending') {
    return { ok: false, status: 409, error: 'Claim request is no longer pending' }
  }

  const { data: organizer } = await admin
    .from('organizers')
    .select('id, claimed_by')
    .eq('id', request.organizer_id)
    .maybeSingle()

  if (!organizer) {
    return { ok: false, status: 404, error: 'Organizer not found' }
  }
  if (organizer.claimed_by && organizer.claimed_by !== request.requested_by) {
    return { ok: false, status: 409, error: 'Organizer was claimed by someone else' }
  }

  const now = new Date().toISOString()

  const { data: claimedOrganizer, error: orgError } = await admin
    .from('organizers')
    .update({
      claimed_by: request.requested_by,
      popup_hub_coordinator_id: request.requested_by,
      claimed_at: now,
      updated_at: now,
    })
    .eq('id', request.organizer_id)
    .or(`claimed_by.is.null,claimed_by.eq.${request.requested_by}`)
    .select('id')
    .maybeSingle()

  if (orgError) {
    return { ok: false, status: 500, error: orgError.message }
  }
  if (!claimedOrganizer) {
    return { ok: false, status: 409, error: 'Organizer was claimed by someone else' }
  }

  const { data: approvedRequest, error: approveError } = await admin
    .from('organizer_claim_requests')
    .update({
      status: 'approved',
      reviewed_by: adminUserId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (approveError) {
    await admin
      .from('organizers')
      .update({
        claimed_by: null,
        popup_hub_coordinator_id: null,
        claimed_at: null,
        updated_at: now,
      })
      .eq('id', request.organizer_id)
      .eq('claimed_by', request.requested_by)
    return { ok: false, status: 500, error: approveError.message }
  }
  if (!approvedRequest) {
    await admin
      .from('organizers')
      .update({
        claimed_by: null,
        popup_hub_coordinator_id: null,
        claimed_at: null,
        updated_at: now,
      })
      .eq('id', request.organizer_id)
      .eq('claimed_by', request.requested_by)
    return { ok: false, status: 409, error: 'Claim request is no longer pending' }
  }

  await admin
    .from('organizer_claim_requests')
    .update({
      status: 'rejected',
      reviewed_by: adminUserId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('organizer_id', request.organizer_id)
    .eq('status', 'pending')
    .neq('id', requestId)

  return { ok: true }
}

export async function rejectOrganizerClaimRequest(
  requestId: string,
  adminUserId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const admin = createAdminClient()

  const { data: request } = await admin
    .from('organizer_claim_requests')
    .select('id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (!request) {
    return { ok: false, status: 404, error: 'Claim request not found' }
  }
  if (request.status !== 'pending') {
    return { ok: false, status: 409, error: 'Claim request is no longer pending' }
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('organizer_claim_requests')
    .update({
      status: 'rejected',
      reviewed_by: adminUserId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', requestId)

  if (error) {
    return { ok: false, status: 500, error: error.message }
  }

  return { ok: true }
}
