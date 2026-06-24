import { isApplicationAwaitingBoothPayment } from '@/lib/applications/payment-fields'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

assert(
  isApplicationAwaitingBoothPayment({
    status: 'approved',
    payment_method: 'SQUARE',
    payment_status: 'payment_required',
    application_payment_status: null,
  }),
  'digital checkout still required should be eligible for auto-release'
)

assert(
  !isApplicationAwaitingBoothPayment({
    status: 'approved',
    payment_method: 'SQUARE',
    payment_status: 'paid',
    application_payment_status: null,
  }),
  'paid digital applications must not auto-release'
)

assert(
  !isApplicationAwaitingBoothPayment({
    status: 'approved',
    payment_method: 'SQUARE',
    payment_status: 'processing',
    application_payment_status: null,
  }),
  'processing digital payments must not auto-release'
)

assert(
  isApplicationAwaitingBoothPayment({
    status: 'pending',
    payment_method: 'ETRANSFER',
    payment_status: 'pending',
    application_payment_status: 'PENDING_REVIEW',
  }),
  'offline pending review should be eligible for auto-release'
)

assert(
  !isApplicationAwaitingBoothPayment({
    status: 'approved',
    payment_method: 'ETRANSFER',
    payment_status: 'paid',
    application_payment_status: 'COMPLETED',
  }),
  'completed offline payments must not auto-release'
)

console.log('payment-chase-release-guards.test.ts: ok')
