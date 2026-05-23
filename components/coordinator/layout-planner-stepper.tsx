'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type LayoutPlannerStep = 1 | 2 | 3 | 4

const STEPS: { id: LayoutPlannerStep; label: string; hint: string }[] = [
  { id: 1, label: 'Venue', hint: 'Hall & dimensions' },
  { id: 2, label: 'Constraints', hint: 'Tables & rules' },
  { id: 3, label: 'Canvas', hint: 'Floorplan layout' },
  { id: 4, label: 'Export', hint: 'QA & print' },
]

interface LayoutPlannerStepperProps {
  currentStep: LayoutPlannerStep
  onStepChange?: (step: LayoutPlannerStep) => void
  maxReachableStep?: LayoutPlannerStep
}

export function LayoutPlannerStepper({
  currentStep,
  onStepChange,
  maxReachableStep = 4,
}: LayoutPlannerStepperProps) {
  return (
    <nav
      aria-label="Layout planner progress"
      className="market-panel px-4 py-3 border-2 border-stone-300 bg-linen/80"
    >
      <ol className="flex flex-wrap items-center justify-between gap-2 sm:gap-0">
        {STEPS.map((step, index) => {
          const isActive = currentStep === step.id
          const isComplete = currentStep > step.id
          const isReachable = step.id <= maxReachableStep
          const connectorDone = currentStep > step.id

          return (
            <li
              key={step.id}
              className={cn(
                'flex flex-1 min-w-[140px] items-center',
                index < STEPS.length - 1 && 'sm:pr-2'
              )}
            >
              <button
                type="button"
                disabled={!isReachable || !onStepChange}
                onClick={() => isReachable && onStepChange?.(step.id)}
                className={cn(
                  'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                  isReachable && onStepChange ? 'hover:bg-canvas/80' : 'cursor-default',
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
              {index < STEPS.length - 1 ? (
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

interface LayoutPlannerWizardNavProps {
  currentStep: LayoutPlannerStep
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  backLabel?: string
  nextDisabled?: boolean
  showBack?: boolean
}

export function LayoutPlannerWizardNav({
  currentStep,
  onBack,
  onNext,
  nextLabel,
  backLabel = 'Back',
  nextDisabled = false,
  showBack = currentStep > 1,
}: LayoutPlannerWizardNavProps) {
  const defaultNext =
    currentStep === 1
      ? 'Next: Set Baseline Constraints'
      : currentStep === 2
        ? 'Next: Open Layout Canvas'
        : currentStep === 3
          ? 'Next: Review & Export'
          : 'Finish'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      {showBack && onBack ? (
        <Button type="button" variant="outline" className="min-h-11" onClick={onBack}>
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      {onNext ? (
        <Button type="button" className="min-h-11 gap-1.5" disabled={nextDisabled} onClick={onNext}>
          {nextLabel ?? defaultNext}
        </Button>
      ) : null}
    </div>
  )
}
