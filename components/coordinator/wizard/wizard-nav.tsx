'use client'

import { Button } from '@/components/ui/button'
import { WizardProceedButton } from '@/components/coordinator/wizard/wizard-ui'
import {
  WIZARD_BTN_SECONDARY,
  WIZARD_NAV_DIVIDER,
} from '@/lib/wizard/wizard-panel-styles'

/**
 * 3-step wizard: Event & Venue → Capacity → Floor Plan.
 * (Step 1 was previously "Event Details" + Step 2 "Venue"; they are now
 * a single combined step.)
 */
export type WizardStep = 1 | 2 | 3

interface WizardNavProps {
  step: WizardStep
  onBack?: () => void
  onNext?: () => void
  nextDisabled?: boolean
  nextLabel?: string
  /** Step 1 only — enables proceed CTA pulse when validation passes. */
  stepReady?: boolean
  /** Quarter-auction listing uses vendor-spots copy instead of market capacity/floor plan. */
  isQuarterAuction?: boolean
  /** When true, step 2 finishes the wizard (skip venue layout). */
  skipVenueLayout?: boolean
}

export function WizardNav({
  step,
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
  stepReady,
  isQuarterAuction = false,
  skipVenueLayout = false,
}: WizardNavProps) {
  const defaultNext = isQuarterAuction
    ? step === 1
      ? 'Proceed to vendor spots →'
      : 'Save & open auction control →'
    : step === 1
      ? 'Proceed to Capacity Settings →'
      : step === 2
        ? skipVenueLayout
          ? 'Save market'
          : 'Open Floor Plan Canvas →'
        : 'Save market'

  return (
    // On mobile we stack the buttons full-width so the Proceed CTA is
    // never clipped by other floating UI (eg. mobile bottom-bar) and is
    // always tappable. Above sm we restore the desktop side-by-side
    // arrangement with wrap behaviour for very narrow content.
    <div
      className={`flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${WIZARD_NAV_DIVIDER}`}
    >
      {step > 1 && onBack ? (
        <Button
          type="button"
          variant="outline"
          className={`${WIZARD_BTN_SECONDARY} w-full sm:w-auto`}
          onClick={onBack}
        >
          ← Back
        </Button>
      ) : (
        <span className="hidden sm:block" />
      )}
      {onNext ? (
        <WizardProceedButton
          ready={step === 1 && stepReady}
          disabled={nextDisabled}
          onClick={onNext}
          className="w-full sm:w-auto"
        >
          {nextLabel ?? defaultNext}
        </WizardProceedButton>
      ) : null}
    </div>
  )
}
