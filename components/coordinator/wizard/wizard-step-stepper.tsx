'use client'

import { cn } from '@/lib/utils'
import { WIZARD_PANEL } from '@/lib/wizard/wizard-panel-styles'
import type { WizardStep } from '@/components/coordinator/wizard/wizard-nav'

export interface WizardStepDefinition {
  id: WizardStep
  label: string
  hint: string
}

/**
 * 3-step wizard for full markets — the previous "Event Details" and "Venue"
 * steps were merged into a single combined first step so coordinators can
 * fill the entire context (name + schedule + venue + map pin) without a
 * forced page transition.
 */
export const MARKET_WIZARD_STEPS_FULL: WizardStepDefinition[] = [
  { id: 1, label: 'Event & Venue', hint: 'Name, schedule, location & map' },
  { id: 2, label: 'Capacity', hint: 'Categories & booths' },
  { id: 3, label: 'Floor Plan', hint: 'Layout canvas' },
]

/** 2-step wizard for "skip venue layout" markets (capacity-only, no canvas). */
export const MARKET_WIZARD_STEPS_SHORT: WizardStepDefinition[] = [
  { id: 1, label: 'Event & Venue', hint: 'Name, schedule, location & map' },
  { id: 2, label: 'Capacity', hint: 'Categories & deploy' },
]

/** 2-step wizard for quarter auctions — no floor plan, vendor spots instead of booth capacity. */
export const QUARTER_AUCTION_WIZARD_STEPS: WizardStepDefinition[] = [
  { id: 1, label: 'Event & Venue', hint: 'Name, schedule, location & map' },
  { id: 2, label: 'Vendor spots', hint: 'Who can sell tonight' },
]

interface WizardStepStepperProps {
  steps: WizardStepDefinition[]
  currentStep: WizardStep
  maxReachedStep: WizardStep
  onStepChange?: (step: WizardStep) => void
  allowNavigation?: boolean
  /** Accessible name for the progress nav (listing-aware). */
  ariaLabel?: string
}

export function WizardStepStepper({
  steps,
  currentStep,
  maxReachedStep,
  onStepChange,
  allowNavigation = false,
  ariaLabel = 'Market setup wizard progress',
}: WizardStepStepperProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(WIZARD_PANEL, 'px-4 py-3')}
    >
      <ol className="flex flex-wrap items-center justify-between gap-2 sm:gap-0">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id
          const isComplete = currentStep > step.id
          const isReachable = allowNavigation && step.id <= maxReachedStep
          const connectorDone = currentStep > step.id

          return (
            <li
              key={step.id}
              className={cn(
                'flex flex-1 min-w-[140px] items-center',
                index < steps.length - 1 && 'sm:pr-2'
              )}
            >
              <button
                type="button"
                disabled={!isReachable || !onStepChange || isActive}
                onClick={() => isReachable && onStepChange?.(step.id)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all duration-200',
                  isReachable && onStepChange && !isActive
                    ? 'hover:bg-white/40 cursor-pointer'
                    : 'cursor-default',
                  !isReachable && 'opacity-50'
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-heading font-bold transition-colors',
                    isActive && 'border-forest bg-forest text-primary-foreground shadow-sm',
                    isComplete && !isActive && 'border-sage-500 bg-sage-100 text-forest',
                    !isActive && !isComplete && 'border-stone-300 bg-card text-muted-foreground'
                  )}
                >
                  {isComplete ? '✓' : step.id}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-xs font-heading font-semibold uppercase tracking-wide truncate',
                      isActive ? 'text-forest' : 'text-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="block text-[10px] text-muted-foreground truncate">{step.hint}</span>
                </span>
              </button>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    'hidden sm:block h-0.5 flex-1 mx-2 rounded-full',
                    connectorDone ? 'bg-sage-400' : 'bg-stone-200'
                  )}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
