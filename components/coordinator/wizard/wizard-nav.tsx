'use client'

import { Button } from '@/components/ui/button'
import {
  WIZARD_BTN_PRIMARY,
  WIZARD_BTN_SECONDARY,
  WIZARD_NAV_DIVIDER,
} from '@/lib/wizard/wizard-panel-styles'

export type WizardStep = 1 | 2 | 3 | 4

interface WizardNavProps {
  step: WizardStep
  onBack?: () => void
  onNext?: () => void
  nextDisabled?: boolean
  nextLabel?: string
}

export function WizardNav({ step, onBack, onNext, nextDisabled, nextLabel }: WizardNavProps) {
  const defaultNext =
    step === 1
      ? 'Proceed to Venue Location →'
      : step === 2
        ? 'Proceed to Capacity Settings →'
        : step === 3
          ? 'Open Floor Plan Canvas →'
          : 'Save floor plan & deploy'

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 pt-4 ${WIZARD_NAV_DIVIDER}`}>
      {step > 1 && onBack ? (
        <Button type="button" variant="outline" className={WIZARD_BTN_SECONDARY} onClick={onBack}>
          ← Back
        </Button>
      ) : (
        <span />
      )}
      {onNext ? (
        <Button type="button" className={WIZARD_BTN_PRIMARY} disabled={nextDisabled} onClick={onNext}>
          {nextLabel ?? defaultNext}
        </Button>
      ) : null}
    </div>
  )
}
