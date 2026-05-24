import type { SupabaseClient } from '@supabase/supabase-js'

/** Stale processing claims older than this may be reclaimed for retry. */
export const STALE_PAYMENT_PROCESSING_MS = 10 * 60 * 1000

export function isCategoryCapacityError(error: { message?: string } | null | undefined): boolean {
  if (!error?.message) return false
  return error.message.includes('category_full')
}

export function isPaymentProcessingStale(processingAt: string | null | undefined): boolean {
  if (!processingAt) return false
  return Date.now() - new Date(processingAt).getTime() > STALE_PAYMENT_PROCESSING_MS
}

export async function reclaimStalePaymentProcessing(
  supabase: SupabaseClient,
  applicationId: string
): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_PAYMENT_PROCESSING_MS).toISOString()

  const { data } = await supabase
    .from('booth_applications')
    .update({
      payment_status: 'payment_required',
      payment_processing_at: null,
    })
    .eq('id', applicationId)
    .eq('payment_status', 'processing')
    .is('square_payment_id', null)
    .lt('payment_processing_at', staleBefore)
    .select('id')
    .maybeSingle()

  return !!data
}
