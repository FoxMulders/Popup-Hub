'use client'

import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { WorkspaceInspector } from '@/components/experience-designer/inspector/workspace-inspector'
import { WorkspaceShell } from '@/components/experience-designer/workspace-shell'
import { WorkspaceStepHeader } from '@/components/experience-designer/workspace-step-header'
import { WizardLeftPanel } from '@/components/experience-designer/wizard/wizard-left-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiFetchError } from '@/lib/api/api-fetch'
import {
  fetchArchitecturalSkeleton,
  fetchPuzzlesForSkeleton,
} from '@/lib/experience-designer/generate-skeleton'
import type {
  CouncilTelemetry,
  ExperienceConstraints,
  ExperienceDesignerStep,
  RoomSkeleton,
} from '@/lib/experience-designer/types'

const BlueprintCanvas = lazy(() =>
  import('@/components/experience-designer/canvas/blueprint-canvas').then((mod) => ({
    default: mod.BlueprintCanvas,
  }))
)

function BlueprintCanvasFallback() {
  return <Skeleton className="h-full w-full rounded-none bg-white/[0.04]" aria-hidden />
}

const DEFAULT_CONSTRAINTS: ExperienceConstraints = {
  theme: 'cyber_heist',
  venueType: 'popup_trailer',
  targetPlayerCount: 6,
  deploymentMode: 'commercial',
}

const IDLE_TELEMETRY: CouncilTelemetry = {
  councilStatus: 'idle',
  activeAgents: [],
  consensusScore: 0,
  tokensUsed: 0,
}

export function ExperienceDesignerWorkspace() {
  const [currentStep, setCurrentStep] = useState<ExperienceDesignerStep>(1)
  const [maxReachedStep, setMaxReachedStep] = useState<ExperienceDesignerStep>(1)
  const [constraints, setConstraints] = useState<ExperienceConstraints>(DEFAULT_CONSTRAINTS)
  const [roomSkeleton, setRoomSkeleton] = useState<RoomSkeleton | null>(null)
  const [puzzlesGenerated, setPuzzlesGenerated] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [generatingSkeleton, setGeneratingSkeleton] = useState(false)
  const [generatingPuzzles, setGeneratingPuzzles] = useState(false)
  const [telemetry, setTelemetry] = useState<CouncilTelemetry>(IDLE_TELEMETRY)
  const [generatorSessionId, setGeneratorSessionId] = useState<string | undefined>()
  const [generationError, setGenerationError] = useState<string | null>(null)

  const handleStepChange = useCallback((step: ExperienceDesignerStep) => {
    setCurrentStep(step)
  }, [])

  const handleStepAdvance = useCallback((step: ExperienceDesignerStep) => {
    setCurrentStep(step)
    setMaxReachedStep((prev) => (step > prev ? step : prev))
  }, [])

  const handleGenerateSkeleton = useCallback(async () => {
    setGeneratingSkeleton(true)
    setGenerationError(null)
    setTelemetry({
      councilStatus: 'generating',
      activeAgents: ['Spatial Architect', 'Flow Analyst', 'Safety Reviewer'],
      consensusScore: 0,
      tokensUsed: 0,
      lastAction: 'Drafting zone graph from constraints…',
    })

    try {
      const result = await fetchArchitecturalSkeleton(constraints, generatorSessionId)
      setRoomSkeleton(result.roomSkeleton)
      setGeneratorSessionId(result.sessionId)
      setPuzzlesGenerated(false)
      setSelectedZoneId(null)
      setTelemetry(result.telemetry)
      setMaxReachedStep((prev) => (prev < 2 ? 2 : prev))
    } catch (err) {
      const message =
        err instanceof ApiFetchError
          ? err.message
          : 'Could not generate architectural skeleton.'
      setGenerationError(message)
      setTelemetry(IDLE_TELEMETRY)
    } finally {
      setGeneratingSkeleton(false)
    }
  }, [constraints, generatorSessionId])

  const handleGeneratePuzzles = useCallback(async () => {
    if (!roomSkeleton) return

    setGeneratingPuzzles(true)
    setGenerationError(null)
    setTelemetry((prev) => ({
      ...prev,
      councilStatus: 'generating',
      activeAgents: ['Puzzle Smith', 'Hardware Estimator', 'Firmware Scribe'],
      lastAction: 'Assigning mechanisms and BOM lines…',
    }))

    try {
      const result = await fetchPuzzlesForSkeleton(constraints, roomSkeleton, generatorSessionId)
      setRoomSkeleton(result.roomSkeleton)
      setGeneratorSessionId(result.sessionId)
      setPuzzlesGenerated(true)
      setTelemetry(result.telemetry)
      setMaxReachedStep((prev) => (prev < 3 ? 3 : prev))
    } catch (err) {
      const message =
        err instanceof ApiFetchError ? err.message : 'Could not generate puzzles.'
      setGenerationError(message)
    } finally {
      setGeneratingPuzzles(false)
    }
  }, [constraints, generatorSessionId, roomSkeleton])

  const header = useMemo(
    () => (
      <WorkspaceStepHeader
        currentStep={currentStep}
        maxReachedStep={maxReachedStep}
        onStepChange={handleStepChange}
      />
    ),
    [currentStep, maxReachedStep, handleStepChange]
  )

  return (
    <ReactFlowProvider>
      <WorkspaceShell
        header={header}
        left={
          <WizardLeftPanel
            currentStep={currentStep}
            constraints={constraints}
            onConstraintsChange={setConstraints}
            roomSkeleton={roomSkeleton}
            puzzlesGenerated={puzzlesGenerated}
            generatingSkeleton={generatingSkeleton}
            generatingPuzzles={generatingPuzzles}
            generationError={generationError}
            onGenerateSkeleton={handleGenerateSkeleton}
            onGeneratePuzzles={handleGeneratePuzzles}
            onStepAdvance={handleStepAdvance}
          />
        }
        center={
          <Suspense fallback={<BlueprintCanvasFallback />}>
            <BlueprintCanvas
              roomSkeleton={roomSkeleton}
              selectedZoneId={selectedZoneId}
              onZoneSelect={setSelectedZoneId}
            />
          </Suspense>
        }
        right={
          <WorkspaceInspector
            selectedZoneId={selectedZoneId}
            roomSkeleton={roomSkeleton}
            telemetry={telemetry}
            constraints={constraints}
            onClearSelection={() => setSelectedZoneId(null)}
          />
        }
      />
    </ReactFlowProvider>
  )
}
