import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlatformFeeMode } from '@/types/database'

export interface RecordPlatformTransactionParams {
  boothApplicationId: string | null
  eventId: string
  vendorId: string
  coordinatorId: string
  categoryId: string | null
  totalAmountCents: number
  platformFeeCents: number
  feeModeUsed: PlatformFeeMode
  processorChargeId: string
  processorTransferId?: string | null
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
}

/**
 * Persist fee split audit row and link to booth_application when applicable.
 */
export async function recordPlatformTransaction(
  supabase: SupabaseClient,
  params: RecordPlatformTransactionParams
) {
  const organizerPayout = params.totalAmountCents - params.platformFeeCents

  const { data: tx, error: txError } = await supabase
    .from('platform_transactions')
    .insert({
      booth_application_id: params.boothApplicationId,
      event_id: params.eventId,
      vendor_id: params.vendorId,
      coordinator_id: params.coordinatorId,
      category_id: params.categoryId,
      total_amount_charged: params.totalAmountCents,
      organizer_payout_amount: organizerPayout,
      platform_fee_retained: params.platformFeeCents,
      fee_mode_used: params.feeModeUsed,
      processor_charge_id: params.processorChargeId,
      processor_transfer_id: params.processorTransferId ?? null,
      status: params.status ?? 'completed',
    })
    .select('id')
    .single()

  if (txError || !tx) {
    return { transactionId: null, error: txError?.message ?? 'Failed to record transaction' }
  }

  if (params.boothApplicationId) {
    await supabase
      .from('booth_applications')
      .update({
        platform_transaction_id: tx.id,
        payment_status: 'paid',
        square_payment_id: params.processorChargeId,
      })
      .eq('id', params.boothApplicationId)
  }

  return { transactionId: tx.id, error: null }
}
