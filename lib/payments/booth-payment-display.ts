import type {
  ApplicationPaymentStatus,
  BoothApplication,
  PaymentMethod,
  PaymentStatus,
} from '@/types/database'
import { isDigitalPaymentMethod, isOfflinePaymentMethod } from '@/lib/applications/payment-fields'

/** Vendor-facing checkout method (spec); maps to booth_applications.payment_method enum. */
export type VendorCheckoutMethod = 'credit_card' | 'etransfer' | 'cash'

/** Coordinator map / telemetry display status (spec). */
export type BoothAssignmentPaymentStatus = 'pending_payment' | 'paid'

export function toVendorCheckoutMethod(method: PaymentMethod): VendorCheckoutMethod {
  if (method === 'ETRANSFER') return 'etransfer'
  if (method === 'CASH') return 'cash'
  return 'credit_card'
}

export function fromVendorCheckoutMethod(
  method: VendorCheckoutMethod,
  options: { preferStripe?: boolean }
): PaymentMethod {
  if (method === 'etransfer') return 'ETRANSFER'
  if (method === 'cash') return 'CASH'
  return options.preferStripe ? 'STRIPE' : 'SQUARE'
}

export function resolveBoothAssignmentPaymentStatus(
  app: Pick<
    BoothApplication,
    'payment_status' | 'payment_method' | 'application_payment_status'
  >
): BoothAssignmentPaymentStatus {
  if (isOfflinePaymentMethod(app.payment_method)) {
    return app.application_payment_status === 'COMPLETED' ? 'paid' : 'pending_payment'
  }
  return app.payment_status === 'paid' ? 'paid' : 'pending_payment'
}

export function isBoothPendingPayment(
  app: Pick<
    BoothApplication,
    'payment_status' | 'payment_method' | 'application_payment_status'
  >
): boolean {
  return resolveBoothAssignmentPaymentStatus(app) === 'pending_payment'
}

export function resolvePaymentStatusForOfflineApply(): {
  payment_status: PaymentStatus
  application_payment_status: ApplicationPaymentStatus
} {
  return {
    payment_status: 'pending',
    application_payment_status: 'PENDING_REVIEW',
  }
}

export function isCreditCardProcessor(method: PaymentMethod | null | undefined): boolean {
  return isDigitalPaymentMethod(method)
}
