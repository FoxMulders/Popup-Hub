import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlatformFeeMode } from '@/types/database'

export type PaymentProcessorKind = 'square' | 'stripe' | 'offline'

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
  processor?: PaymentProcessorKind
}

/**
 * Persist fee split audit row and link to booth_application when applicable.
 * Idempotent on processor_charge_id — safe for webhook + direct payment races.
 */
export async function recordPlatformTransaction(
  supabase: SupabaseClient,
  params: RecordPlatformTransactionParams
) {
  if (params.processorChargeId) {
    const { data: existing } = await supabase
      .from('platform_transactions')
      .select('id')
      .eq('processor_charge_id', params.processorChargeId)
      .maybeSingle()

    if (existing) {
      if (params.boothApplicationId) {
        await supabase
          .from('booth_applications')
          .update(buildApplicationPaymentUpdate(params, existing.id))
          .eq('id', params.boothApplicationId)
      }

      return { transactionId: existing.id, error: null, duplicate: true as const }
    }
  }

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
    if (txError?.code === '23505' && params.processorChargeId) {
      const { data: raced } = await supabase
        .from('platform_transactions')
        .select('id')
        .eq('processor_charge_id', params.processorChargeId)
        .maybeSingle()

      if (raced) {
        if (params.boothApplicationId) {
          await supabase
            .from('booth_applications')
            .update(buildApplicationPaymentUpdate(params, raced.id))
            .eq('id', params.boothApplicationId)
        }

        return { transactionId: raced.id, error: null, duplicate: true as const }
      }
    }

    return { transactionId: null, error: txError?.message ?? 'Failed to record transaction' }
  }

  if (params.boothApplicationId) {
    await supabase
      .from('booth_applications')
      .update(buildApplicationPaymentUpdate(params, tx.id))
      .eq('id', params.boothApplicationId)
  }

  return { transactionId: tx.id, error: null, duplicate: false as const }
}

function buildApplicationPaymentUpdate(
  params: RecordPlatformTransactionParams,
  platformTransactionId?: string
) {
  const processor = params.processor ?? 'square'
  const update: Record<string, unknown> = {
    platform_transaction_id: platformTransactionId ?? undefined,
    payment_status: 'paid',
    payment_processing_at: null,
  }

  if (processor === 'stripe') {
    update.stripe_payment_id = params.processorChargeId
  } else if (processor === 'square') {
    update.square_payment_id = params.processorChargeId
  }

  return update
}
