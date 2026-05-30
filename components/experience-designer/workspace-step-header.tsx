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
    <nav aria-label="Experience design progress" className="flex w-full items-center gap-1">
      <ol className="flex min-w-0 flex-1 items-center gap-1">
        {STEPS.map((step, index) => {
          const isActive = currentStep === step.id
          const isComplete = currentStep > step.id
          const isReachable = step.id <= maxReachedStep

          return (
            <li key={step.id} className="flex min-w-0 items-center">
              <button
                type="button"
                disabled={!isReachable || !onStepChange}
                onClick={() => isReachable && onStepChange?.(step.id)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors',
                  isReachable && onStepChange && !isActive
                    ? 'cursor-pointer hover:bg-white/5'
                    : 'cursor-default',
                  !isReachable && 'opacity-40'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                    isActive && 'bg-sky-500 text-white',
                    isComplete && !isActive && 'bg-emerald-500/20 text-emerald-300',
                    !isActive && !isComplete && 'bg-white/10 text-white/60'
                  )}
                >
                  {isComplete ? '✓' : step.id}
                </span>
                <span
                  className={cn(
                    'truncate text-sm font-medium',
                    isActive ? 'text-white' : 'text-white/70'
                  )}
                >
                  {step.label}
                </span>
              </button>
              {index < STEPS.length - 1 ? (
                <ChevronRight className="mx-0.5 h-4 w-4 shrink-0 text-white/25" aria-hidden />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
