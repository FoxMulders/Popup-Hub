import type {
  ApplicationPaymentStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/types/database'
import { isApplicationPaid, PAYMENT_METHOD_LABELS } from '@/lib/applications/payment-fields'

export interface ApplicationPaymentSummaryInput {
  payment_status: PaymentStatus
  payment_method: PaymentMethod | string | null
  application_payment_status: ApplicationPaymentStatus | string | null
}

/** Coordinator matrix / vendor dashboard payment line (method + settlement state). */
export function formatApplicationPaymentSummary(
  app: ApplicationPaymentSummaryInput | null | undefined
): string {
  if (!app) return '—'

  const method = app.payment_method as PaymentMethod | null
  const methodLabel =
    method && method in PAYMENT_METHOD_LABELS
      ? PAYMENT_METHOD_LABELS[method as PaymentMethod]
      : method
        ? String(method)
        : 'Not selected'

  const paidCheck = {
    payment_status: app.payment_status,
    payment_method: method,
    application_payment_status: app.application_payment_status as ApplicationPaymentStatus | null,
  }

  if (isApplicationPaid(paidCheck)) {
    return `Paid · ${methodLabel}`
  }

  if (method === 'ETRANSFER' || method === 'CASH') {
    if (app.application_payment_status === 'PENDING_REVIEW') {
      return `Pending · ${methodLabel}`
    }
    if (app.application_payment_status === 'EXPIRED') {
      return `Expired · ${methodLabel}`
    }
  }

  if (app.payment_status === 'payment_required' || app.payment_status === 'pending') {
    return `Unpaid · ${methodLabel}`
  }

  if (app.payment_status === 'processing') {
    return `Processing · ${methodLabel}`
  }

  if (app.payment_status === 'refunded') {
    return `Refunded · ${methodLabel}`
  }

  return `Unpaid · ${methodLabel}`
}
