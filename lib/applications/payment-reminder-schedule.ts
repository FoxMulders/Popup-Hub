import type { PaymentReminderStage } from '@/lib/email/payment-due-reminder'

const HOUR_MS = 60 * 60 * 1000

export type NextPaymentReminder = {
  stage: PaymentReminderStage
  kind: 'reminder'
}

/** Escalating reminder tiers based on time remaining until payment_due_at. */
export function resolveNextReminderStage(
  msLeft: number,
  currentStage: number
): NextPaymentReminder | null {
  if (msLeft <= 0) return null

  if (currentStage === 0 && msLeft > 6 * HOUR_MS) {
    return { stage: 1, kind: 'reminder' }
  }
  if (currentStage < 2 && msLeft <= 24 * HOUR_MS && msLeft > 6 * HOUR_MS) {
    return { stage: 2, kind: 'reminder' }
  }
  if (currentStage < 3 && msLeft <= 6 * HOUR_MS) {
    return { stage: 3, kind: 'reminder' }
  }
  return null
}
