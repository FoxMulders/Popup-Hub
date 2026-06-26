/** Columns coordinators may update via offline `payment_status` sync. */
export const OPS_SYNC_PAYMENT_STATUS_FIELDS = new Set([
  'payment_status',
  'application_payment_status',
])

export function pickOpsSyncPaymentStatusUpdates(
  updates: Record<string, unknown>
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updates)) {
    if (OPS_SYNC_PAYMENT_STATUS_FIELDS.has(key)) {
      picked[key] = value
    }
  }
  return picked
}
