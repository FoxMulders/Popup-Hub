import type {
  ApplicationPaymentStatus,
  BoothApplication,
  PaymentMethod,
  PaymentStatus,
} from '@/types/database'
import {
  readUnifiedEventPaymentFlags,
  type EventPaymentFlagRow,
} from '@/lib/payments/event-payment-flags'
import type { VendorCheckoutMethod } from '@/lib/payments/booth-payment-display'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  SQUARE: 'Square (card)',
  STRIPE: 'Stripe (card)',
  ETRANSFER: 'E-transfer',
  CASH: 'Cash',
}

export const APPLICATION_PAYMENT_STATUS_LABELS: Record<ApplicationPaymentStatus, string> = {
  PENDING_REVIEW: 'Pending review',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
}

export const OFFLINE_PAYMENT_GATE_MESSAGE =
  'Vendor cannot be marked as Approved until their offline payment is marked as Paid.'

export function isOfflinePaymentMethod(method: PaymentMethod | null | undefined): boolean {
  return method === 'ETRANSFER' || method === 'CASH'
}

export function isDigitalPaymentMethod(method: PaymentMethod | null | undefined): boolean {
  return method === 'SQUARE' || method === 'STRIPE'
}

export function normalizePaymentMethod(value: unknown): PaymentMethod {
  if (value === 'STRIPE') return 'STRIPE'
  if (value === 'ETRANSFER' || value === 'etransfer') return 'ETRANSFER'
  if (value === 'CASH' || value === 'cash') return 'CASH'
  if (value === 'credit_card') return 'SQUARE'
  return 'SQUARE'
}

export function isApplicationPaid(
  app: Pick<
    BoothApplication,
    'payment_status' | 'payment_method' | 'application_payment_status'
  >
): boolean {
  if (isOfflinePaymentMethod(app.payment_method)) {
    return app.application_payment_status === 'COMPLETED'
  }
  return app.payment_status === 'paid'
}

export function needsDigitalCheckout(
  app: Pick<
    BoothApplication,
    'payment_status' | 'payment_method' | 'application_payment_status' | 'status'
  >
): boolean {
  return (
    app.status === 'approved' &&
    isDigitalPaymentMethod(app.payment_method) &&
    app.payment_status === 'payment_required'
  )
}

/** @deprecated Use needsDigitalCheckout */
export const needsSquareCheckout = needsDigitalCheckout

export function needsOfflineCoordinatorReview(
  app: Pick<
    BoothApplication,
    'payment_method' | 'application_payment_status' | 'status'
  >
): boolean {
  return (
    app.status === 'approved' &&
    isOfflinePaymentMethod(app.payment_method) &&
    app.application_payment_status === 'PENDING_REVIEW'
  )
}

/** @deprecated Use needsOfflineCoordinatorReview */
export const needsEtransferCoordinatorReview = needsOfflineCoordinatorReview

export function isOfflineAwaitingPayment(
  app: Pick<
    BoothApplication,
    'payment_method' | 'application_payment_status'
  >
): boolean {
  return (
    isOfflinePaymentMethod(app.payment_method) &&
    app.application_payment_status !== 'COMPLETED'
  )
}

/** True when booth fee is outstanding and the payment chase cron should act. */
export function isApplicationAwaitingBoothPayment(
  app: Pick<
    BoothApplication,
    'status' | 'payment_status' | 'payment_method' | 'application_payment_status'
  >
): boolean {
  if (needsDigitalCheckout(app)) return true
  if (
    app.status === 'pending' &&
    isOfflinePaymentMethod(app.payment_method) &&
    app.application_payment_status === 'PENDING_REVIEW'
  ) {
    return true
  }
  return needsOfflineCoordinatorReview(app)
}

/** @deprecated Use isOfflineAwaitingPayment */
export const isEtransferAwaitingPayment = isOfflineAwaitingPayment

export const ETRANSFER_PAYMENT_GATE_MESSAGE = OFFLINE_PAYMENT_GATE_MESSAGE

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

  if (isOfflinePaymentMethod(paymentMethod)) {
    return {
      payment_method: paymentMethod,
      payment_status: 'pending',
      application_payment_status: 'PENDING_REVIEW',
    }
  }

  return {
    payment_method: paymentMethod,
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
  if (isOfflinePaymentMethod(app.payment_method)) {
    const methodLabel = app.payment_method ? PAYMENT_METHOD_LABELS[app.payment_method] : 'Offline'
    const status = app.application_payment_status ?? 'PENDING_REVIEW'
    return `${methodLabel} · ${APPLICATION_PAYMENT_STATUS_LABELS[status]}`
  }
  if (app.payment_method === 'STRIPE') {
    if (app.payment_status === 'paid') return 'Paid (Stripe)'
    if (app.payment_status === 'payment_required') return 'Awaiting Stripe payment'
  }
  if (app.payment_status === 'paid') return 'Paid (Square)'
  if (app.payment_status === 'payment_required') return 'Awaiting Square payment'
  return app.payment_status
}

export type EventPaymentAcceptance = EventPaymentFlagRow

export function resolveEnabledPaymentMethods(
  event: EventPaymentAcceptance,
  options: {
    squareConnected?: boolean
    stripeConnected?: boolean
  } = {}
): PaymentMethod[] {
  const flags = readUnifiedEventPaymentFlags(event)
  const methods: PaymentMethod[] = []

  if (flags.accepts_credit_card) {
    const stripeOk = options.stripeConnected === true
    const squareOk = options.squareConnected !== false
    if (stripeOk && (event.accepts_stripe === true || flags.accepts_credit_card)) {
      methods.push('STRIPE')
    }
    if (squareOk && event.accepts_square !== false) {
      methods.push('SQUARE')
    }
    if (methods.length === 0 && flags.accepts_credit_card) {
      if (stripeOk) methods.push('STRIPE')
      else if (squareOk) methods.push('SQUARE')
    }
  }

  if (flags.accepts_etransfer) {
    methods.push('ETRANSFER')
  }
  if (flags.accepts_cash) {
    methods.push('CASH')
  }
  return methods
}

/** Single card option when any digital processor is enabled (vendor-facing spec). */
export function resolveVendorCheckoutMethods(
  event: EventPaymentAcceptance,
  options: {
    squareConnected?: boolean
    stripeConnected?: boolean
  } = {}
): VendorCheckoutMethod[] {
  const internal = resolveEnabledPaymentMethods(event, options)
  const out: VendorCheckoutMethod[] = []
  if (internal.some((m) => m === 'SQUARE' || m === 'STRIPE')) {
    out.push('credit_card')
  }
  if (internal.includes('ETRANSFER')) out.push('etransfer')
  if (internal.includes('CASH')) out.push('cash')
  return out
}

export function resolvePreferredDigitalPaymentMethod(
  enabled: PaymentMethod[]
): PaymentMethod {
  if (enabled.includes('STRIPE')) return 'STRIPE'
  if (enabled.includes('SQUARE')) return 'SQUARE'
  return 'SQUARE'
}

export function normalizeVendorCheckoutToPaymentMethod(
  checkout: VendorCheckoutMethod | PaymentMethod | undefined,
  enabled: PaymentMethod[]
): PaymentMethod {
  if (checkout === 'etransfer' || checkout === 'ETRANSFER') return 'ETRANSFER'
  if (checkout === 'cash' || checkout === 'CASH') return 'CASH'
  if (checkout === 'STRIPE' || checkout === 'SQUARE') {
    return enabled.includes(checkout as PaymentMethod)
      ? (checkout as PaymentMethod)
      : resolvePreferredDigitalPaymentMethod(enabled)
  }
  return resolvePreferredDigitalPaymentMethod(enabled)
}

export function isPaymentMethodAllowed(
  method: PaymentMethod,
  event: EventPaymentAcceptance,
  options: {
    squareConnected?: boolean
    stripeConnected?: boolean
  } = {}
): boolean {
  return resolveEnabledPaymentMethods(event, options).includes(method)
}
