'use client'

import { Loader2, Wand2 } from 'lucide-react'
import { PanelFooter, PanelHeader } from '@/components/experience-designer/wizard/step-constraints-panel'

export interface StepSpatialPanelProps {
  hasSkeleton: boolean
  generating: boolean
  onGenerate: () => void
  onContinue: () => void
}

export function StepSpatialPanel({
  hasSkeleton,
  generating,
  onGenerate,
  onContinue,
}: StepSpatialPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        step={2}
        title="Spatial layout"
        subtitle="Generate an architectural skeleton — zones and flow paths appear on the persistent canvas."
      />
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-xs leading-relaxed text-white/55">
          The council proposes entry, corridor, puzzle, and climax zones sized to your venue type
          and player count. Drag nodes on the canvas to refine placement — the skeleton persists
          across steps.
        </p>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="touch-target flex w-full min-h-12 items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:opacity-60 touch-manipulation"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          Generate architectural skeleton
        </button>
        {hasSkeleton ? (
          <p className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200/90">
            Skeleton loaded on canvas. Pan, zoom, and drag zones to adjust the spatial plan.
          </p>
        ) : null}
      </div>
      <PanelFooter>
        <button
          type="button"
          onClick={onContinue}
          disabled={!hasSkeleton}
          className="touch-target w-full min-h-12 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
        >
          Continue to puzzles
        </button>
      </PanelFooter>
    </div>
  )
}
