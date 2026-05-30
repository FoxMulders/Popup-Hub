import type {
  CouncilTelemetry,
  ExperienceConstraints,
  ExperienceDesignerStep,
  RoomSkeleton,
} from '@/lib/experience-designer/types'

export interface WizardLeftPanelProps {
  currentStep: ExperienceDesignerStep
  constraints: ExperienceConstraints
  onConstraintsChange: (constraints: ExperienceConstraints) => void
  roomSkeleton: RoomSkeleton | null
  puzzlesGenerated: boolean
  generatingSkeleton: boolean
  generatingPuzzles: boolean
  generationError?: string | null
  onGenerateSkeleton: () => void
  onGeneratePuzzles: () => void
  onStepAdvance: (step: ExperienceDesignerStep) => void
}

export interface WorkspaceInspectorProps {
  selectedZoneId: string | null
  roomSkeleton: RoomSkeleton | null
  telemetry: CouncilTelemetry
  constraints: ExperienceConstraints
  onClearSelection: () => void
}
