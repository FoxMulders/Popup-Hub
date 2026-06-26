const PAYMENT_STATUS_FIELDS = new Set(['payment_status', 'application_payment_status'])

export function pickPaymentStatusUpdates(
  updates: Record<string, unknown>
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updates)) {
    if (PAYMENT_STATUS_FIELDS.has(key)) picked[key] = value
  }
  return picked
}
