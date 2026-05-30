'use client'

import type { ExperienceDesignerStep } from '@/lib/experience-designer/types'
import { StepConstraintsPanel } from '@/components/experience-designer/wizard/step-constraints-panel'
import { StepSpatialPanel } from '@/components/experience-designer/wizard/step-spatial-panel'
import { StepPuzzlesPanel } from '@/components/experience-designer/wizard/step-puzzles-panel'
import { StepReviewPanel } from '@/components/experience-designer/wizard/step-review-panel'
import type { WizardLeftPanelProps } from '@/components/experience-designer/wizard/wizard-left-panel-types'

export function WizardLeftPanel({
  currentStep,
  constraints,
  onConstraintsChange,
  roomSkeleton,
  puzzlesGenerated,
  generatingSkeleton,
  generatingPuzzles,
  generationError,
  onGenerateSkeleton,
  onGeneratePuzzles,
  onStepAdvance,
}: WizardLeftPanelProps) {
  const errorBanner = generationError ? (
    <p className="mx-4 mb-2 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100/90">
      {generationError}
    </p>
  ) : null

  switch (currentStep as ExperienceDesignerStep) {
    case 1:
      return (
        <>
          {errorBanner}
          <StepConstraintsPanel
            constraints={constraints}
            onChange={onConstraintsChange}
            onContinue={() => onStepAdvance(2)}
          />
        </>
      )
    case 2:
      return (
        <>
          {errorBanner}
          <StepSpatialPanel
            hasSkeleton={Boolean(roomSkeleton?.zones.length)}
            generating={generatingSkeleton}
            onGenerate={onGenerateSkeleton}
            onContinue={() => onStepAdvance(3)}
          />
        </>
      )
    case 3:
      return (
        <>
          {errorBanner}
          <StepPuzzlesPanel
            hasSkeleton={Boolean(roomSkeleton?.zones.length)}
            puzzlesGenerated={puzzlesGenerated}
            generating={generatingPuzzles}
            onGenerate={onGeneratePuzzles}
            onContinue={() => onStepAdvance(4)}
          />
        </>
      )
    case 4:
      return (
        <StepReviewPanel
          constraints={constraints}
          roomSkeleton={roomSkeleton}
          puzzlesGenerated={puzzlesGenerated}
        />
      )
    default:
      return null
  }
}
