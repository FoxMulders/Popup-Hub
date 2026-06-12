import type { SupabaseClient } from '@supabase/supabase-js'
import {
  REQUIRED_COORDINATOR_VOUCHES,
  REQUIRED_VENDOR_VOUCHES,
  coordinatorVouchThresholdMet,
  type CoordinatorVouchCounts,
} from '@/lib/coordinator/escrow-policy'
import { markCoordinatorCommunityVerified } from '@/lib/coordinator/escrow'
import { logSecurityEvent } from '@/lib/security/audit-log'

/** Low-risk verified vendors may vouch for organizers (spec: risk_score < 25). */
export const VOUCH_VENDOR_MAX_RISK_SCORE = 25

export type VouchEligibility = {
  ok: true
} | {
  ok: false
  reason: string
}

export type CoordinatorVouchProgress = CoordinatorVouchCounts & {
  coordinatorVerified: boolean
}

export function vendorCanVouchForCoordinator(passport: {
  risk_score?: number | null
  verification_status?: string | null
  account_status?: string | null
} | null | undefined): VouchEligibility {
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

export function coordinatorCanVouchForCoordinator(profile: {
  role?: string | null
  coordinator_is_verified?: boolean | null
  coordinator_account_status?: string | null
} | null | undefined): VouchEligibility {
  if (!profile || profile.role !== 'coordinator') {
    return { ok: false, reason: 'Organizer account required to vouch for another organizer.' }
  }

  const status = profile.coordinator_account_status ?? 'active'
  if (status === 'suspended' || status === 'banned') {
    return { ok: false, reason: 'Your organizer account cannot vouch for others while suspended.' }
  }

  if (profile.coordinator_is_verified !== true) {
    return {
      ok: false,
      reason: 'Only community-verified organizers can vouch for other organizers.',
    }
  }

  return { ok: true }
}

export async function countVendorVouchesForCoordinator(
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

export async function countCoordinatorPeerVouchesForCoordinator(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('coordinator_peer_vouches')
    .select('id', { count: 'exact', head: true })
    .eq('coordinator_id', coordinatorId)

  if (error) throw error
  return count ?? 0
}

export async function loadCoordinatorVouchCounts(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<CoordinatorVouchCounts> {
  const [vendorVouchCount, coordinatorVouchCount] = await Promise.all([
    countVendorVouchesForCoordinator(supabase, coordinatorId),
    countCoordinatorPeerVouchesForCoordinator(supabase, coordinatorId),
  ])

  return { vendorVouchCount, coordinatorVouchCount }
}

/** @deprecated Use loadCoordinatorVouchCounts */
export async function countDistinctVouchesForCoordinator(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<number> {
  return countVendorVouchesForCoordinator(supabase, coordinatorId)
}

async function coordinatorsSharePaidVendor(
  supabase: SupabaseClient,
  voucherCoordinatorId: string,
  targetCoordinatorId: string
): Promise<boolean> {
  const [{ data: voucherEvents }, { data: targetEvents }] = await Promise.all([
    supabase.from('events').select('id').eq('coordinator_id', voucherCoordinatorId).limit(100),
    supabase.from('events').select('id').eq('coordinator_id', targetCoordinatorId).limit(100),
  ])

  const voucherEventIds = (voucherEvents ?? []).map((row) => row.id)
  const targetEventIds = (targetEvents ?? []).map((row) => row.id)

  if (voucherEventIds.length === 0 || targetEventIds.length === 0) {
    return false
  }

  const [{ data: voucherPaidApps }, { data: targetPaidApps }] = await Promise.all([
    supabase
      .from('booth_applications')
      .select('vendor_id')
      .in('event_id', voucherEventIds)
      .eq('status', 'approved')
      .eq('payment_status', 'paid')
      .limit(200),
    supabase
      .from('booth_applications')
      .select('vendor_id')
      .in('event_id', targetEventIds)
      .eq('status', 'approved')
      .eq('payment_status', 'paid')
      .limit(200),
  ])

  const targetVendorIds = new Set((targetPaidApps ?? []).map((row) => row.vendor_id))
  return (voucherPaidApps ?? []).some((row) => targetVendorIds.has(row.vendor_id))
}

export async function maybeMarkCommunityVerifiedFromVouches(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<{ counts: CoordinatorVouchCounts; coordinatorVerified: boolean }> {
  const counts = await loadCoordinatorVouchCounts(supabase, coordinatorId)

  if (coordinatorVouchThresholdMet(counts)) {
    await markCoordinatorCommunityVerified(supabase, coordinatorId, 'vouches')
    return { counts, coordinatorVerified: true }
  }

  return { counts, coordinatorVerified: false }
}

export async function vendorVouchForCoordinator(
  supabase: SupabaseClient,
  params: {
    vendorId: string
    coordinatorId: string
  }
): Promise<
  | {
      ok: true
      vendorVouchCount: number
      coordinatorVouchCount: number
      coordinatorVerified: boolean
    }
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

  if (
    coordinator.coordinator_account_status === 'suspended' ||
    coordinator.coordinator_account_status === 'banned'
  ) {
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

  const { counts, coordinatorVerified } = await maybeMarkCommunityVerifiedFromVouches(
    supabase,
    params.coordinatorId
  )

  return {
    ok: true,
    vendorVouchCount: counts.vendorVouchCount,
    coordinatorVouchCount: counts.coordinatorVouchCount,
    coordinatorVerified,
  }
}

export async function coordinatorPeerVouchForCoordinator(
  supabase: SupabaseClient,
  params: {
    voucherCoordinatorId: string
    targetCoordinatorId: string
  }
): Promise<
  | {
      ok: true
      vendorVouchCount: number
      coordinatorVouchCount: number
      coordinatorVerified: boolean
    }
  | { ok: false; status: number; error: string }
> {
  if (params.voucherCoordinatorId === params.targetCoordinatorId) {
    return { ok: false, status: 400, error: 'You cannot vouch for yourself.' }
  }

  const [{ data: target }, { data: voucher }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, role, coordinator_account_status')
      .eq('id', params.targetCoordinatorId)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, role, coordinator_is_verified, coordinator_account_status')
      .eq('id', params.voucherCoordinatorId)
      .maybeSingle(),
  ])

  if (!target || target.role !== 'coordinator') {
    return { ok: false, status: 404, error: 'Organizer not found.' }
  }

  if (
    target.coordinator_account_status === 'suspended' ||
    target.coordinator_account_status === 'banned'
  ) {
    return { ok: false, status: 403, error: 'This organizer cannot receive vouches.' }
  }

  const eligibility = coordinatorCanVouchForCoordinator(voucher)
  if (!eligibility.ok) {
    return { ok: false, status: 403, error: eligibility.reason }
  }

  const sharesPaidVendor = await coordinatorsSharePaidVendor(
    supabase,
    params.voucherCoordinatorId,
    params.targetCoordinatorId
  )

  if (!sharesPaidVendor) {
    return {
      ok: false,
      status: 403,
      error:
        'You can only vouch for organizers who share at least one paid vendor with your markets.',
    }
  }

  const { error: insertError } = await supabase.from('coordinator_peer_vouches').insert({
    coordinator_id: params.targetCoordinatorId,
    voucher_id: params.voucherCoordinatorId,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return { ok: false, status: 409, error: 'You have already vouched for this organizer.' }
    }
    return { ok: false, status: 500, error: insertError.message }
  }

  await logSecurityEvent({
    eventType: 'coordinator_peer_vouch',
    actorId: params.voucherCoordinatorId,
    metadata: {
      coordinatorId: params.targetCoordinatorId,
      voucherCoordinatorId: params.voucherCoordinatorId,
    },
  })

  const { counts, coordinatorVerified } = await maybeMarkCommunityVerifiedFromVouches(
    supabase,
    params.targetCoordinatorId
  )

  return {
    ok: true,
    vendorVouchCount: counts.vendorVouchCount,
    coordinatorVouchCount: counts.coordinatorVouchCount,
    coordinatorVerified,
  }
}

export {
  REQUIRED_VENDOR_VOUCHES,
  REQUIRED_COORDINATOR_VOUCHES,
  coordinatorVouchThresholdMet,
}
