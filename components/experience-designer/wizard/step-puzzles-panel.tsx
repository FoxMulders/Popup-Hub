'use client'

import { Loader2, Puzzle } from 'lucide-react'
import { PanelFooter, PanelHeader } from '@/components/experience-designer/wizard/step-constraints-panel'

export interface StepPuzzlesPanelProps {
  hasSkeleton: boolean
  puzzlesGenerated: boolean
  generating: boolean
  onGenerate: () => void
  onContinue: () => void
}

export function StepPuzzlesPanel({
  hasSkeleton,
  puzzlesGenerated,
  generating,
  onGenerate,
  onContinue,
}: StepPuzzlesPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        step={3}
        title="Puzzles"
        subtitle="Populate puzzle zones with mechanisms, BOM lines, and Arduino sketches."
      />
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!hasSkeleton ? (
          <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
            Generate an architectural skeleton in step 2 before assigning puzzles.
          </p>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-white/55">
              Click any puzzle zone on the canvas to inspect BOM and firmware in the right panel.
            </p>
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating || !hasSkeleton}
              className="touch-target flex w-full min-h-12 items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-60 touch-manipulation"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Puzzle className="h-4 w-4" />
              )}
              Generate puzzles
            </button>
            {puzzlesGenerated ? (
              <p className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200/90">
                Puzzle metadata attached. Select zones on the canvas to review hardware and code.
              </p>
            ) : null}
          </>
        )}
      </div>
      <PanelFooter>
        <button
          type="button"
          onClick={onContinue}
          disabled={!puzzlesGenerated}
          className="touch-target w-full min-h-12 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
        >
          Continue to final review
        </button>
      </PanelFooter>
    </div>
  )
}
