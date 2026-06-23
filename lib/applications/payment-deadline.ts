/** Hours after approval/offline checkout before payment is due (platform default). */
export const PAYMENT_DUE_HOURS_AFTER_APPROVAL = 72

/** Hard cutoff: payment must clear this many days before the market starts. */
export const PAYMENT_CUTOFF_DAYS_BEFORE_EVENT = 7

/** Never set a deadline sooner than this from "now" when computing. */
export const PAYMENT_DEADLINE_MIN_LEAD_MS = 60 * 60 * 1000

export type PaymentDeadlineInput = {
  anchorAt: Date | string
  eventStartAt: Date | string
  eventPaymentDueAt?: string | null
  now?: Date
}

/** Resolve the effective payment deadline (strictest of platform rules + optional event override). */
export function resolvePaymentDueAt(input: PaymentDeadlineInput): string {
  const now = input.now ?? new Date()
  const anchor = new Date(input.anchorAt)
  const eventStart = new Date(input.eventStartAt)

  const afterApprovalMs = PAYMENT_DUE_HOURS_AFTER_APPROVAL * 60 * 60 * 1000
  const beforeEventMs = PAYMENT_CUTOFF_DAYS_BEFORE_EVENT * 24 * 60 * 60 * 1000

  const afterApproval = new Date(anchor.getTime() + afterApprovalMs)
  const beforeEvent = new Date(eventStart.getTime() - beforeEventMs)

  let due = afterApproval.getTime() <= beforeEvent.getTime() ? afterApproval : beforeEvent

  if (input.eventPaymentDueAt) {
    const override = new Date(input.eventPaymentDueAt)
    if (!Number.isNaN(override.getTime()) && override.getTime() < due.getTime()) {
      due = override
    }
  }

  const minDue = new Date(now.getTime() + PAYMENT_DEADLINE_MIN_LEAD_MS)
  if (due.getTime() < minDue.getTime()) {
    due = minDue
  }

  return due.toISOString()
}

export function formatPaymentDueAtDisplay(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function paymentDueCountdownLabel(iso: string, now: Date = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime()
  if (ms <= 0) return 'Past due'

  const hours = Math.floor(ms / (60 * 60 * 1000))
  const days = Math.floor(hours / 24)
  if (days >= 2) return `${days} days left`
  if (days === 1) return '1 day left'
  if (hours >= 1) return `${hours} hours left`
  const minutes = Math.max(1, Math.floor(ms / (60 * 1000)))
  return `${minutes} minutes left`
}

/** Cleared when payment is received — resets chase state. */
export const PAYMENT_CHASE_CLEARED_FIELDS = {
  payment_due_at: null,
  last_payment_reminder_at: null,
  payment_reminder_stage: 0,
} as const
