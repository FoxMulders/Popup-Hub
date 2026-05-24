import type {
  ApplicationPaymentStatus,
  BoothApplication,
  PaymentMethod,
  PaymentStatus,
} from '@/types/database'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  SQUARE: 'Square (card)',
  ETRANSFER: 'E-transfer',
}

export const APPLICATION_PAYMENT_STATUS_LABELS: Record<ApplicationPaymentStatus, string> = {
  PENDING_REVIEW: 'Pending review',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
}

export function normalizePaymentMethod(value: unknown): PaymentMethod {
  return value === 'ETRANSFER' ? 'ETRANSFER' : 'SQUARE'
}

export function isApplicationPaid(
  app: Pick<
    BoothApplication,
    'payment_status' | 'payment_method' | 'application_payment_status'
  >
): boolean {
  if (app.payment_method === 'ETRANSFER') {
    return app.application_payment_status === 'COMPLETED'
  }
  return app.payment_status === 'paid'
}

export function needsSquareCheckout(
  app: Pick<
    BoothApplication,
    'payment_status' | 'payment_method' | 'application_payment_status' | 'status'
  >
): boolean {
  return (
    app.status === 'approved' &&
    app.payment_method !== 'ETRANSFER' &&
    app.payment_status === 'payment_required'
  )
}

export function needsEtransferCoordinatorReview(
  app: Pick<
    BoothApplication,
    'payment_method' | 'application_payment_status' | 'status'
  >
): boolean {
  return (
    app.status === 'approved' &&
    app.payment_method === 'ETRANSFER' &&
    app.application_payment_status === 'PENDING_REVIEW'
  )
}

export function resolvePaymentFieldsForPaidApplication({
  paymentMethod,
  requiresPayment,
  approved,
}: {
  paymentMethod: PaymentMethod
  requiresPayment: boolean
  approved: boolean
}): {
  payment_method: PaymentMethod | null
  payment_status: PaymentStatus
  application_payment_status: ApplicationPaymentStatus | null
} {
  if (!requiresPayment) {
    return {
      payment_method: null,
      payment_status: 'unpaid',
      application_payment_status: null,
    }
  }

  if (paymentMethod === 'ETRANSFER') {
    return {
      payment_method: 'ETRANSFER',
      payment_status: 'pending',
      application_payment_status: approved ? 'PENDING_REVIEW' : null,
    }
  }

  return {
    payment_method: 'SQUARE',
    payment_status: approved ? 'payment_required' : 'unpaid',
    application_payment_status: null,
  }
}

export function formatApplicationPaymentLabel(
  app: Pick<
    BoothApplication,
    'payment_status' | 'payment_method' | 'application_payment_status'
  >
): string {
  if (app.payment_method === 'ETRANSFER') {
    const status = app.application_payment_status ?? 'PENDING_REVIEW'
    return `E-transfer · ${APPLICATION_PAYMENT_STATUS_LABELS[status]}`
  }
  if (app.payment_status === 'paid') return 'Paid (Square)'
  if (app.payment_status === 'payment_required') return 'Awaiting Square payment'
  return app.payment_status
}
