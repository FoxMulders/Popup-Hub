import {
  isApplicationPaid,
  needsDigitalCheckout,
  needsOfflineCoordinatorReview,
} from '@/lib/applications/payment-fields'
import {
  formatPaymentDueAtDisplay,
  paymentDueCountdownLabel,
} from '@/lib/applications/payment-deadline'
import type { ApplicationStatus, BoothApplication } from '@/types/database'

export type VendorBookingStepKey = 'apply' | 'review' | 'booth' | 'payment'

export type VendorBookingStepState = 'complete' | 'current' | 'upcoming' | 'blocked'

export interface VendorBookingStep {
  key: VendorBookingStepKey
  label: string
  detail: string
  state: VendorBookingStepState
}

function reviewComplete(status: ApplicationStatus): boolean {
  return (
    status === 'approved' ||
    status === 'pending_insurance' ||
    status === 'rejected' ||
    status === 'cancelled'
  )
}

function reviewBlocked(status: ApplicationStatus): boolean {
  return status === 'rejected' || status === 'cancelled'
}

/** Four-step vendor journey: apply → review → booth → payment. */
export function buildVendorBookingSteps(app: BoothApplication): VendorBookingStep[] {
  const status = app.status
  const paid = isApplicationPaid(app)
  const needsPay = needsDigitalCheckout(app) || needsOfflineCoordinatorReview(app)
  const hasBooth = app.booth_number != null
  const reviewDone = reviewComplete(status)
  const blocked = reviewBlocked(status)

  const apply: VendorBookingStep = {
    key: 'apply',
    label: 'Application submitted',
    detail: 'Your passport and booth request were sent to the organizer.',
    state: 'complete',
  }

  let reviewState: VendorBookingStepState = 'current'
  let reviewDetail = 'The organizer is reviewing your application.'
  if (status === 'waitlisted') {
    reviewDetail = 'You are waitlisted — we will notify you if a spot opens.'
  } else if (status === 'pending_insurance') {
    reviewState = 'complete'
    reviewDetail = 'Approved — upload insurance proof to finalize.'
  } else if (status === 'approved') {
    reviewState = 'complete'
    reviewDetail = 'Organizer approved your application.'
  } else if (blocked) {
    reviewState = 'blocked'
    reviewDetail =
      status === 'rejected'
        ? 'This application was not selected.'
        : 'This event was cancelled.'
  } else if (reviewDone) {
    reviewState = 'complete'
  }

  const review: VendorBookingStep = {
    key: 'review',
    label: 'Organizer review',
    detail: reviewDetail,
    state: reviewState,
  }

  let boothState: VendorBookingStepState = blocked ? 'blocked' : 'upcoming'
  let boothDetail = 'After approval, the organizer assigns your booth on HubGrid.'
  if (hasBooth) {
    boothState = 'complete'
    boothDetail = `Booth #${app.booth_number} is on the floor plan.`
  } else if (status === 'approved' || status === 'pending_insurance') {
    boothState = 'current'
    boothDetail = 'Approved — waiting for booth placement on the floor plan.'
  }

  const booth: VendorBookingStep = {
    key: 'booth',
    label: 'Booth assigned',
    detail: boothDetail,
    state: boothState,
  }

  let paymentState: VendorBookingStepState = blocked ? 'blocked' : 'upcoming'
  let paymentDetail = 'Pay booth fees when the organizer requests payment.'
  if (paid || (status === 'approved' && !needsPay && !needsDigitalCheckout(app))) {
    paymentState = 'complete'
    paymentDetail = paid ? 'Booth fee confirmed.' : 'No booth fee required for this market.'
  } else if (needsPay) {
    paymentState = 'current'
    const dueSuffix =
      app.payment_due_at != null
        ? ` Pay by ${formatPaymentDueAtDisplay(app.payment_due_at)} (${paymentDueCountdownLabel(app.payment_due_at)}).`
        : ''
    paymentDetail = needsDigitalCheckout(app)
      ? `Complete card payment to secure your booth.${dueSuffix}`
      : `Send e-transfer or confirm offline payment with the organizer.${dueSuffix}`
  } else if (status === 'approved' || status === 'pending_insurance') {
    paymentState = hasBooth ? 'current' : 'upcoming'
  }

  const payment: VendorBookingStep = {
    key: 'payment',
    label: 'Payment confirmed',
    detail: paymentDetail,
    state: paymentState,
  }

  return [apply, review, booth, payment]
}

export function vendorBookingStepsActive(app: BoothApplication): boolean {
  return (
    app.status === 'pending' ||
    app.status === 'pending_insurance' ||
    app.status === 'approved' ||
    app.status === 'waitlisted'
  )
}
