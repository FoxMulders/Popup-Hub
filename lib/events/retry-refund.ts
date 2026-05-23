import type { SupabaseClient } from '@supabase/supabase-js'
import { refundSquarePayment } from '@/lib/square/refunds'

export async function retryRefundException(
  supabase: SupabaseClient,
  params: { exceptionId: string; coordinatorId: string }
) {
  const { data: ex, error } = await supabase
    .from('refund_exceptions')
    .select('*')
    .eq('id', params.exceptionId)
    .eq('coordinator_id', params.coordinatorId)
    .eq('status', 'pending_retry')
    .single()

  if (error || !ex) {
    return { ok: false, error: 'Refund exception not found' }
  }

  if (!ex.square_payment_id || ex.square_payment_id === 'missing') {
    return { ok: false, error: 'No Square payment id on record — cannot refund automatically' }
  }

  const idempotencyKey = `rt-${ex.id}`.slice(0, 45)
  const { refundId, error: refundError } = await refundSquarePayment({
    paymentId: ex.square_payment_id,
    amountCents: ex.amount_cents as number,
    reason: 'Popup Hub: manual refund retry after event cancellation',
    idempotencyKey,
  })

  if (refundError || !refundId) {
    await supabase
      .from('refund_exceptions')
      .update({
        error_message: refundError ?? 'Retry failed',
        retry_count: (ex.retry_count as number) + 1,
        last_retry_at: new Date().toISOString(),
      })
      .eq('id', ex.id)

    return { ok: false, error: refundError ?? 'Retry failed' }
  }

  await supabase
    .from('refund_exceptions')
    .update({
      status: 'resolved',
      square_refund_id: refundId,
      resolved_at: new Date().toISOString(),
      retry_count: (ex.retry_count as number) + 1,
      last_retry_at: new Date().toISOString(),
    })
    .eq('id', ex.id)

  await supabase
    .from('booth_applications')
    .update({ payment_status: 'refunded', status: 'cancelled' })
    .eq('id', ex.booth_application_id)

  await supabase
    .from('platform_transactions')
    .update({ status: 'refunded' })
    .eq('processor_charge_id', ex.square_payment_id)

  return { ok: true, refundId }
}
