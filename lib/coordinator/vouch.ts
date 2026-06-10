import type { SupabaseClient } from '@supabase/supabase-js'
import {
  REQUIRED_VOUCHES,
  markCoordinatorCommunityVerified,
} from '@/lib/coordinator/escrow'
import { logSecurityEvent } from '@/lib/security/audit-log'

/** Low-risk verified vendors may vouch for organizers (spec: risk_score < 25). */
export const VOUCH_VENDOR_MAX_RISK_SCORE = 25

export type VendorVouchEligibility = {
  ok: true
} | {
  ok: false
  reason: string
}

export function vendorCanVouchForCoordinator(passport: {
  risk_score?: number | null
  verification_status?: string | null
  account_status?: string | null
} | null | undefined): VendorVouchEligibility {
  if (!passport) {
    return { ok: false, reason: 'Complete your Vendor Passport before vouching for an organizer.' }
  }

  if (passport.account_status !== 'active') {
    return { ok: false, reason: 'Your vendor account must be active to vouch for an organizer.' }
  }

  if (passport.verification_status !== 'verified') {
    return { ok: false, reason: 'Only verified vendors can vouch for organizers.' }
  }

  if ((passport.risk_score ?? 0) >= VOUCH_VENDOR_MAX_RISK_SCORE) {
    return { ok: false, reason: 'Your account risk score is too high to vouch for organizers.' }
  }

  return { ok: true }
}

export async function countDistinctVouchesForCoordinator(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('coordinator_vouches')
    .select('id', { count: 'exact', head: true })
    .eq('coordinator_id', coordinatorId)

  if (error) throw error
  return count ?? 0
}

export async function vendorVouchForCoordinator(
  supabase: SupabaseClient,
  params: {
    vendorId: string
    coordinatorId: string
  }
): Promise<
  | { ok: true; vouchCount: number; coordinatorVerified: boolean }
  | { ok: false; status: number; error: string }
> {
  if (params.vendorId === params.coordinatorId) {
    return { ok: false, status: 400, error: 'You cannot vouch for yourself.' }
  }

  const [{ data: coordinator }, { data: passport }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, role, coordinator_account_status')
      .eq('id', params.coordinatorId)
      .maybeSingle(),
    supabase
      .from('vendor_passports')
      .select('user_id, risk_score, verification_status, account_status')
      .eq('user_id', params.vendorId)
      .maybeSingle(),
  ])

  if (!coordinator || coordinator.role !== 'coordinator') {
    return { ok: false, status: 404, error: 'Organizer not found.' }
  }

  if (coordinator.coordinator_account_status === 'suspended' || coordinator.coordinator_account_status === 'banned') {
    return { ok: false, status: 403, error: 'This organizer cannot receive vouches.' }
  }

  const eligibility = vendorCanVouchForCoordinator(passport)
  if (!eligibility.ok) {
    return { ok: false, status: 403, error: eligibility.reason }
  }

  const { data: coordinatorEvents } = await supabase
    .from('events')
    .select('id')
    .eq('coordinator_id', params.coordinatorId)
    .limit(50)

  const eventIds = (coordinatorEvents ?? []).map((row) => row.id)
  if (eventIds.length === 0) {
    return { ok: false, status: 403, error: 'This organizer has no markets yet.' }
  }

  const { data: sharedApplication } = await supabase
    .from('booth_applications')
    .select('id')
    .eq('vendor_id', params.vendorId)
    .in('event_id', eventIds)
    .limit(1)
    .maybeSingle()

  if (!sharedApplication) {
    return {
      ok: false,
      status: 403,
      error: 'You can only vouch for organizers after applying to one of their markets.',
    }
  }

  const { error: insertError } = await supabase.from('coordinator_vouches').insert({
    coordinator_id: params.coordinatorId,
    vendor_id: params.vendorId,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return { ok: false, status: 409, error: 'You have already vouched for this organizer.' }
    }
    return { ok: false, status: 500, error: insertError.message }
  }

  await logSecurityEvent({
    eventType: 'coordinator_vendor_vouch',
    actorId: params.vendorId,
    vendorId: params.vendorId,
    metadata: { coordinatorId: params.coordinatorId },
  })

  const vouchCount = await countDistinctVouchesForCoordinator(supabase, params.coordinatorId)
  let coordinatorVerified = false

  if (vouchCount >= REQUIRED_VOUCHES) {
    await markCoordinatorCommunityVerified(supabase, params.coordinatorId, 'vouches')
    coordinatorVerified = true
  }

  return { ok: true, vouchCount, coordinatorVerified }
}
