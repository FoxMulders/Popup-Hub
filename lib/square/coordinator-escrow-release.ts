import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureWallet } from '@/lib/wallet/credit-deposit'
import { adjustWalletBalance } from '@/lib/wallet/adjust-balance'

/**
 * Release Square-held escrow (captured via app_fee_money) by crediting the
 * coordinator's Popup Hub wallet. Platform Square balance already received the hold.
 */
export async function releaseSquareEscrowHoldToWallet(
  supabase: SupabaseClient,
  params: {
    coordinatorId: string
    holdId: string
    heldCents: number
  }
): Promise<{ ok: true; walletTransactionId: string } | { ok: false; error: string }> {
  if (params.heldCents <= 0) {
    return { ok: false, error: 'Nothing to release' }
  }

  const { data: existingHold } = await supabase
    .from('coordinator_escrow_holds')
    .select('id, processor_transfer_id')
    .eq('id', params.holdId)
    .maybeSingle()

  if (existingHold?.processor_transfer_id) {
    return { ok: true, walletTransactionId: existingHold.processor_transfer_id }
  }

  const { data: existingRelease } = await supabase
    .from('wallet_transactions')
    .select('id')
    .contains('metadata', { escrow_hold_id: params.holdId, kind: 'coordinator_escrow_release' })
    .maybeSingle()

  if (existingRelease?.id) {
    await supabase
      .from('coordinator_escrow_holds')
      .update({ processor_transfer_id: existingRelease.id })
      .eq('id', params.holdId)
    return { ok: true, walletTransactionId: existingRelease.id }
  }

  const wallet = await ensureWallet(supabase, params.coordinatorId)
  if (!wallet) {
    return { ok: false, error: 'Coordinator wallet not found' }
  }

  const credit = await adjustWalletBalance(supabase, {
    walletId: wallet.id,
    deltaCents: params.heldCents,
  })

  if (!credit.ok) {
    return { ok: false, error: `Wallet credit failed: ${credit.error}` }
  }

  const { data: wtx, error: wtxError } = await supabase
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      type: 'deposit',
      amount: params.heldCents,
      metadata: {
        kind: 'coordinator_escrow_release',
        escrow_hold_id: params.holdId,
        balance_applied: true,
      },
    })
    .select('id')
    .single()

  if (wtxError || !wtx) {
    return { ok: false, error: wtxError?.message ?? 'Failed to record wallet release' }
  }

  await supabase
    .from('coordinator_escrow_holds')
    .update({ processor_transfer_id: wtx.id })
    .eq('id', params.holdId)

  return { ok: true, walletTransactionId: wtx.id }
}
