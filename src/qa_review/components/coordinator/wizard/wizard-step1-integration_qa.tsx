'use client'

/**
 * Step 1 bundle for QA review — event details (description + payment fixes) and venue
 * (predictive Places). Import this from market-setup-wizard when promoting QA to production.
 */

export { WizardStepEventDetailsQa as WizardStepEventDetails } from '@/src/qa_review/components/coordinator/wizard/wizard-step-event-details_step1_qa'
export type { DayRow } from '@/src/qa_review/components/coordinator/wizard/wizard-step-event-details_step1_qa'
export { WizardStepVenueWithMapsProvider } from '@/src/qa_review/components/coordinator/wizard/wizard-step-venue_predictive_search'
export type { PlaceResult } from '@/src/qa_review/components/coordinator/wizard/wizard-place-types_qa'
export { applyWizardGooglePlaceSelect } from '@/src/qa_review/lib/wizard/wizard-google-place-select_qa'
export {
  ALL_VENDOR_PAYMENT_METHODS,
  paymentMethodsFromFlags,
  flagsFromPaymentMethods,
  type VendorPaymentMethodKey,
} from '@/src/qa_review/lib/wizard/vendor-payment-methods_qa'
