'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { LayoutResult } from '@/lib/layout-strategies'
import { cn } from '@/lib/utils'

export interface FairnessScenarioBarProps {
  candidates: LayoutResult[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onApply: () => void
  onDismiss: () => void
  className?: string
}

export function FairnessScenarioBar({
  candidates,
  activeIndex,
  onActiveIndexChange,
  onApply,
  onDismiss,
  className,
}: FairnessScenarioBarProps) {
  if (candidates.length === 0) return null

  const safeIndex = Math.min(Math.max(activeIndex, 0), candidates.length - 1)
  const active = candidates[safeIndex]!
  const label =
    active.scenarioLabel ??
    active.scenarioId ??
    `Scenario ${safeIndex + 1}`
  const isBest = safeIndex === 0

  return (
    <div
      className={cn(
        'pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border border-violet-200/90 bg-violet-50/95 px-3 py-2 shadow-sm backdrop-blur-sm',
        className
      )}
      role="region"
      aria-label="Fairness layout scenario comparison"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-semibold text-violet-950">
          Scenario {safeIndex + 1} of {candidates.length}
          {isBest ? ' · Best' : ''}
        </span>
        <span className="truncate text-[10px] text-violet-800/90">
          {label} · Cap {active.scores?.capacityScore ?? 100} · Cov{' '}
          {active.scores?.coverageScore ?? active.coveragePercentage ?? 0} · Fair{' '}
          {active.fairnessScore}/100 · {active.placements.length} placed
          {active.capacityReport?.isPartialLayout ? ' · partial' : ''}
          {active.layoutValid === false && !active.capacityReport?.isPartialLayout
            ? ' · invalid'
            : ''}
        </span>
        {active.report?.summary ? (
          <span
            className="truncate text-[10px] font-medium text-amber-800/90"
            title={active.report.summary}
          >
            {active.report.summary}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onActiveIndexChange(Math.max(0, safeIndex - 1))}
          disabled={safeIndex <= 0}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-violet-200 bg-white text-violet-900 hover:bg-violet-100 disabled:opacity-40"
          aria-label="Previous scenario"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() =>
            onActiveIndexChange(Math.min(candidates.length - 1, safeIndex + 1))
          }
          disabled={safeIndex >= candidates.length - 1}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-violet-200 bg-white text-violet-900 hover:bg-violet-100 disabled:opacity-40"
          aria-label="Next scenario"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onApply}
          className="rounded-md border border-violet-700 bg-violet-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-800"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-violet-200 bg-white text-violet-800 hover:bg-violet-100"
          aria-label="Close scenario comparison"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

export interface FairnessScenarioCompareButtonProps {
  scenarioCount: number
  onClick: () => void
  className?: string
}

export function FairnessScenarioCompareButton({
  scenarioCount,
  onClick,
  className,
}: FairnessScenarioCompareButtonProps) {
  if (scenarioCount < 2) return null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border border-violet-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-violet-900 hover:bg-violet-50',
        className
      )}
    >
      Compare {scenarioCount} scenarios
    </button>
  )
}
