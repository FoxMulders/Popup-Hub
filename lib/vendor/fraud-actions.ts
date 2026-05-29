import type { SupabaseClient } from '@supabase/supabase-js'
import { evictVendorFromEventLayout } from '@/lib/vendor/evict-vendor-booth'
import { logSecurityEvent } from '@/lib/security/audit-log'

export type DisputeSignal =
  | 'payment.disputed'
  | 'dispute.created'
  | 'payment.failed'
  | 'refund.completed'
  | 'card_velocity'

export async function suspendVendorForPaymentDispute(
  supabase: SupabaseClient,
  input: {
    vendorId: string
    eventId: string
    applicationId: string
    signal: DisputeSignal
    processorReference?: string | null
    actorId?: string | null
  }
): Promise<{ evictedCellCount: number }> {
  const now = new Date().toISOString()

  await supabase
    .from('vendor_passports')
    .update({ account_status: 'suspended' })
    .eq('user_id', input.vendorId)

  await supabase
    .from('booth_applications')
    .update({
      status: 'cancelled',
      booth_number: null,
      payment_status: input.signal === 'refund.completed' ? 'refunded' : 'unpaid',
      updated_at: now,
    })
    .eq('id', input.applicationId)

  const eviction = await evictVendorFromEventLayout(supabase, input.eventId, input.vendorId)

  await logSecurityEvent({
    eventType: 'vendor_dispute_suspension',
    actorId: input.actorId ?? input.vendorId,
    vendorId: input.vendorId,
    eventId: input.eventId,
    applicationId: input.applicationId,
    metadata: {
      signal: input.signal,
      processorReference: input.processorReference ?? null,
    },
  })

  if (eviction.evictedCellCount > 0) {
    await logSecurityEvent({
      eventType: 'vendor_booth_eviction',
      actorId: input.actorId ?? input.vendorId,
      vendorId: input.vendorId,
      eventId: input.eventId,
      applicationId: input.applicationId,
      metadata: {
        evictedCellCount: eviction.evictedCellCount,
        clearedApplications: eviction.clearedApplications,
        reason: input.signal,
      },
    })
  }

  return { evictedCellCount: eviction.evictedCellCount }
}
