'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExperienceDesignerStep } from '@/lib/experience-designer/types'

const STEPS: { id: ExperienceDesignerStep; label: string }[] = [
  { id: 1, label: 'Constraints' },
  { id: 2, label: 'Spatial Layout' },
  { id: 3, label: 'Puzzles' },
  { id: 4, label: 'Final Review' },
]

export interface WorkspaceStepHeaderProps {
  currentStep: ExperienceDesignerStep
  maxReachedStep: ExperienceDesignerStep
  onStepChange?: (step: ExperienceDesignerStep) => void
}

export function WorkspaceStepHeader({
  currentStep,
  maxReachedStep,
  onStepChange,
}: WorkspaceStepHeaderProps) {
  return (
    <nav
      aria-label="Experience design progress"
      className="flex w-full min-w-0 items-center gap-1 overflow-x-auto"
    >
      <ol className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1">
        {STEPS.map((step, index) => {
          const isActive = currentStep === step.id
          const isComplete = currentStep > step.id
          const isReachable = step.id <= maxReachedStep

          return (
            <li key={step.id} className="flex min-w-0 shrink-0 items-center">
              <button
                type="button"
                disabled={!isReachable || !onStepChange}
                onClick={() => isReachable && onStepChange?.(step.id)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'touch-target flex min-h-12 items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors touch-manipulation sm:gap-2 sm:px-2.5',
                  isReachable && onStepChange && !isActive
                    ? 'cursor-pointer hover:bg-white/5'
                    : 'cursor-default',
                  !isReachable && 'opacity-40'
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums sm:h-6 sm:w-6',
                    isActive && 'bg-sky-500 text-white',
                    isComplete && !isActive && 'bg-emerald-500/20 text-emerald-300',
                    !isActive && !isComplete && 'bg-white/10 text-white/60'
                  )}
                >
                  {isComplete ? '✓' : step.id}
                </span>
                <span
                  className={cn(
                    'hidden truncate text-sm font-medium sm:inline',
                    isActive ? 'text-white' : 'text-white/70'
                  )}
                >
                  {step.label}
                </span>
              </button>
              {index < STEPS.length - 1 ? (
                <ChevronRight className="mx-0.5 hidden h-4 w-4 shrink-0 text-white/25 sm:block" aria-hidden />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
