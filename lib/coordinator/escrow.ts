import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureWallet } from '@/lib/wallet/credit-deposit'
import { adjustWalletBalance } from '@/lib/wallet/adjust-balance'
import { logSecurityEvent } from '@/lib/security/audit-log'
import { releaseSquareEscrowHoldToWallet } from '@/lib/square/coordinator-escrow-release'
import {
  computeEscrowEligibleReleaseAt,
  coordinatorEscrowExempt,
  splitOrganizerPayoutCents,
  type CoordinatorEscrowProfile,
  type EscrowSettlementMode,
} from '@/lib/coordinator/escrow-policy'

export {
  ESCROW_HOLD_PERCENT,
  ESCROW_IMMEDIATE_PERCENT,
  REQUIRED_VOUCHES,
  REQUIRED_VENDOR_VOUCHES,
  REQUIRED_COORDINATOR_VOUCHES,
  SUCCESSFUL_EVENTS_FOR_VERIFY,
  ESCROW_RELEASE_HOURS_AFTER_EVENT,
  splitOrganizerPayoutCents,
  computeEscrowEligibleReleaseAt,
  coordinatorEscrowExempt,
  coordinatorRequiresEscrowHold,
  coordinatorVouchThresholdMet,
  type CoordinatorEscrowProfile,
  type CoordinatorVouchCounts,
  type EscrowSettlementMode,
  type EscrowHoldStatus,
} from '@/lib/coordinator/escrow-policy'
import { loadCoordinatorVouchCounts } from '@/lib/coordinator/vouch'
export async function loadCoordinatorEscrowProfile(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<CoordinatorEscrowProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select(
      'coordinator_is_verified, coordinator_successful_events_count, coordinator_verification_status, coordinator_business_number'
    )
    .eq('id', coordinatorId)
    .maybeSingle()

  return data
}

export async function loadCoordinatorEscrowContext(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<{
  profile: CoordinatorEscrowProfile | null
  vendorVouchCount: number
  coordinatorVouchCount: number
  /** @deprecated Use vendorVouchCount */
  vouchCount: number
  escrowExempt: boolean
}> {
  const [profile, counts] = await Promise.all([
    loadCoordinatorEscrowProfile(supabase, coordinatorId),
    loadCoordinatorVouchCounts(supabase, coordinatorId),
  ])

  return {
    profile,
    vendorVouchCount: counts.vendorVouchCount,
    coordinatorVouchCount: counts.coordinatorVouchCount,
    vouchCount: counts.vendorVouchCount,
    escrowExempt: coordinatorEscrowExempt(profile, counts),
  }
}

export async function markCoordinatorCommunityVerified(
  supabase: SupabaseClient,
  coordinatorId: string,
  reason: 'vouches' | 'successful_events' | 'admin' | 'tax_verified'
): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('coordinator_is_verified')
    .eq('id', coordinatorId)
    .maybeSingle()

  if (profile?.coordinator_is_verified) {
    await releaseAllHeldEscrowForCoordinator(supabase, coordinatorId, 'verification')
    return
  }

  await supabase
    .from('profiles')
    .update({ coordinator_is_verified: true })
    .eq('id', coordinatorId)

  await logSecurityEvent({
    eventType: 'coordinator_community_verified',
    actorId: coordinatorId,
    metadata: { reason },
  })

  await releaseAllHeldEscrowForCoordinator(supabase, coordinatorId, 'verification')
}

export async function incrementCoordinatorSuccessfulEvents(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('coordinator_successful_events_count')
    .eq('id', coordinatorId)
    .single()

  if (!profile) return

  const nextCount = (profile.coordinator_successful_events_count ?? 0) + 1

  await supabase
    .from('profiles')
    .update({ coordinator_successful_events_count: nextCount })
    .eq('id', coordinatorId)
}

async function creditWalletEscrowSplit(
  supabase: SupabaseClient,
  coordinatorId: string,
  immediateCents: number,
  heldCents: number
): Promise<void> {
  const wallet = await ensureWallet(supabase, coordinatorId)
  if (!wallet) return

  if (immediateCents > 0) {
    await adjustWalletBalance(supabase, { walletId: wallet.id, deltaCents: immediateCents })
  }

  if (heldCents > 0) {
    const { data: current } = await supabase
      .from('wallets')
      .select('escrow_balance')
      .eq('id', wallet.id)
      .single()

    await supabase
      .from('wallets')
      .update({ escrow_balance: (current?.escrow_balance ?? 0) + heldCents })
      .eq('id', wallet.id)
  }
}

async function releaseWalletEscrowHold(
  supabase: SupabaseClient,
  coordinatorId: string,
  heldCents: number
): Promise<void> {
  if (heldCents <= 0) return

  const wallet = await ensureWallet(supabase, coordinatorId)
  if (!wallet) return

  const { data: current } = await supabase
    .from('wallets')
    .select('escrow_balance, balance')
    .eq('id', wallet.id)
    .single()

  if (!current) return

  const escrowBalance = current.escrow_balance ?? 0
  const releaseCents = Math.min(heldCents, escrowBalance)
  if (releaseCents <= 0) return

  await supabase
    .from('wallets')
    .update({
      escrow_balance: escrowBalance - releaseCents,
      balance: current.balance + releaseCents,
    })
    .eq('id', wallet.id)
}

export async function distributeCoordinatorBoothPayout(
  supabase: SupabaseClient,
  params: {
    platformTransactionId: string
    coordinatorId: string
    eventId: string
    organizerPayoutCents: number
    eventEndAt: string
    settlementMode: EscrowSettlementMode
  }
): Promise<{ escrowApplied: boolean }> {
  if (params.organizerPayoutCents <= 0) {
    return { escrowApplied: false }
  }

  const { data: existingHold } = await supabase
    .from('coordinator_escrow_holds')
    .select('id')
    .eq('platform_transaction_id', params.platformTransactionId)
    .maybeSingle()

  if (existingHold) {
    return { escrowApplied: false }
  }

  const { profile, vendorVouchCount, coordinatorVouchCount } = await loadCoordinatorEscrowContext(
    supabase,
    params.coordinatorId
  )
  const escrowExempt = coordinatorEscrowExempt(profile, {
    vendorVouchCount,
    coordinatorVouchCount,
  })

  if (escrowExempt) {
    if (params.settlementMode === 'wallet') {
      await creditWalletEscrowSplit(supabase, params.coordinatorId, params.organizerPayoutCents, 0)
    }

    return { escrowApplied: false }
  }

  const { immediateCents, heldCents } = splitOrganizerPayoutCents(params.organizerPayoutCents)

  if (params.settlementMode === 'wallet') {
    await creditWalletEscrowSplit(supabase, params.coordinatorId, immediateCents, heldCents)
  }

  await supabase.from('coordinator_escrow_holds').insert({
    platform_transaction_id: params.platformTransactionId,
    coordinator_id: params.coordinatorId,
    event_id: params.eventId,
    organizer_payout_cents: params.organizerPayoutCents,
    immediate_release_cents: immediateCents,
    held_cents: heldCents,
    settlement_mode: params.settlementMode,
    status: heldCents > 0 ? 'held' : 'released',
    eligible_release_at: computeEscrowEligibleReleaseAt(params.eventEndAt),
    released_at: heldCents > 0 ? null : new Date().toISOString(),
  })

  return { escrowApplied: heldCents > 0 }
}

async function releaseEscrowHold(
  supabase: SupabaseClient,
  hold: { id: string; coordinator_id: string; held_cents: number; settlement_mode: EscrowSettlementMode }
): Promise<{ ok: true; processorTransferId?: string } | { ok: false; error: string }> {
  if (hold.held_cents <= 0) {
    return { ok: true }
  }

  if (hold.settlement_mode === 'wallet') {
    await releaseWalletEscrowHold(supabase, hold.coordinator_id, hold.held_cents)
    return { ok: true }
  }

  const result = await releaseSquareEscrowHoldToWallet(supabase, {
    coordinatorId: hold.coordinator_id,
    holdId: hold.id,
    heldCents: hold.held_cents,
  })

  if (!result.ok) {
    return result
  }

  return { ok: true, processorTransferId: result.walletTransactionId }
}

export async function releaseAllHeldEscrowForCoordinator(
  supabase: SupabaseClient,
  coordinatorId: string,
  trigger: 'verification' | 'cron' | 'manual'
): Promise<{ releasedHoldCount: number }> {
  const { data: holds } = await supabase
    .from('coordinator_escrow_holds')
    .select('id, coordinator_id, held_cents, settlement_mode')
    .eq('coordinator_id', coordinatorId)
    .eq('status', 'held')

  if (!holds?.length) {
    return { releasedHoldCount: 0 }
  }

  const now = new Date().toISOString()
  let releasedHoldCount = 0

  for (const hold of holds) {
    const release = await releaseEscrowHold(supabase, {
      id: hold.id,
      coordinator_id: coordinatorId,
      held_cents: hold.held_cents,
      settlement_mode: hold.settlement_mode as EscrowSettlementMode,
    })

    if (!release.ok) {
      continue
    }

    await supabase
      .from('coordinator_escrow_holds')
      .update({
        status: 'released',
        released_at: now,
        processor_transfer_id: release.processorTransferId ?? null,
      })
      .eq('id', hold.id)

    releasedHoldCount += 1
  }

  if (releasedHoldCount === 0) {
    return { releasedHoldCount: 0 }
  }

  await logSecurityEvent({
    eventType: 'coordinator_escrow_mass_release',
    actorId: coordinatorId,
    metadata: { trigger, releasedHoldCount },
  })

  return { releasedHoldCount }
}

export async function eventHasOpenPaymentDisputes(
  supabase: SupabaseClient,
  eventId: string
): Promise<boolean> {
  const { data: refundedApps } = await supabase
    .from('booth_applications')
    .select('id')
    .eq('event_id', eventId)
    .eq('payment_status', 'refunded')
    .limit(1)

  if (refundedApps?.length) return true

  const { data: disputedTx } = await supabase
    .from('platform_transactions')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'refunded')
    .limit(1)

  if (disputedTx?.length) return true

  const { data: suspendedVendors } = await supabase
    .from('booth_applications')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('status', 'cancelled')
    .limit(20)

  if (!suspendedVendors?.length) return false

  const vendorIds = suspendedVendors.map((row) => row.vendor_id)
  const { data: passports } = await supabase
    .from('vendor_passports')
    .select('user_id, account_status')
    .in('user_id', vendorIds)
    .eq('account_status', 'suspended')

  return (passports?.length ?? 0) > 0
}

export async function releaseEligibleEscrowHolds(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<{ releasedEvents: number; blockedEvents: number }> {
  const { data: holds } = await supabase
    .from('coordinator_escrow_holds')
    .select(`
      id,
      coordinator_id,
      event_id,
      held_cents,
      settlement_mode,
      eligible_release_at,
      event:events(end_at, coordinator_id)
    `)
    .eq('status', 'held')
    .lte('eligible_release_at', now.toISOString())

  if (!holds?.length) {
    return { releasedEvents: 0, blockedEvents: 0 }
  }

  const eventIds = [...new Set(holds.map((h) => h.event_id))]
  let releasedEvents = 0
  let blockedEvents = 0

  for (const eventId of eventIds) {
    const eventHolds = holds.filter((h) => h.event_id === eventId)
    const coordinatorId = eventHolds[0]?.coordinator_id
    if (!coordinatorId) continue

    if (await eventHasOpenPaymentDisputes(supabase, eventId)) {
      for (const hold of eventHolds) {
        await supabase
          .from('coordinator_escrow_holds')
          .update({ status: 'blocked' })
          .eq('id', hold.id)
      }
      blockedEvents += 1
      continue
    }

    const releaseNow = new Date().toISOString()

    for (const hold of eventHolds) {
      const release = await releaseEscrowHold(supabase, {
        id: hold.id,
        coordinator_id: coordinatorId,
        held_cents: hold.held_cents,
        settlement_mode: hold.settlement_mode as EscrowSettlementMode,
      })

      if (!release.ok) {
        continue
      }

      await supabase
        .from('coordinator_escrow_holds')
        .update({
          status: 'released',
          released_at: releaseNow,
          processor_transfer_id: release.processorTransferId ?? null,
        })
        .eq('id', hold.id)
    }

    await incrementCoordinatorSuccessfulEvents(supabase, coordinatorId)
    releasedEvents += 1
  }

  return { releasedEvents, blockedEvents }
}
