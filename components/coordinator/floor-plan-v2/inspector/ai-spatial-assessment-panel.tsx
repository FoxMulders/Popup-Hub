'use client'

import { Loader2, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LayoutRecommendResponse } from '@/lib/floor-plan/ai-layout-recommend'

const PANEL_CLASS =
  'flex flex-col gap-3 rounded-lg border border-violet-200/90 bg-violet-50/40 p-3 text-xs shadow-sm'

interface AiSpatialAssessmentPanelProps {
  loading?: boolean
  error?: string | null
  assessment?: LayoutRecommendResponse | null
  onApply?: () => void
  onDismiss?: () => void
  className?: string
}

export function AiSpatialAssessmentPanel({
  loading = false,
  error = null,
  assessment = null,
  onApply,
  onDismiss,
  className,
}: AiSpatialAssessmentPanelProps) {
  if (!loading && !error && !assessment) return null

  return (
    <aside
      className={cn(PANEL_CLASS, className)}
      aria-label="AI Spatial Assessment"
      aria-busy={loading}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-700" aria-hidden />
          <h2 className="text-[0.6875rem] font-bold uppercase tracking-wide text-violet-900">
            AI Spatial Assessment
          </h2>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-violet-600 hover:bg-violet-100"
            aria-label="Dismiss assessment"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-violet-800">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          <span className="text-[0.6875rem] font-medium">Analyzing layout…</span>
        </div>
      ) : null}

      {error && !loading ? (
        <p className="text-[0.6875rem] leading-snug text-red-700">{error}</p>
      ) : null}

      {assessment && !loading ? (
        <>
          {assessment.rationale ? (
            <p className="text-[0.6875rem] leading-relaxed text-violet-950/90">
              {assessment.rationale}
            </p>
          ) : null}

          {assessment.changelog.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-[0.6875rem] leading-snug text-violet-950/85">
              {assessment.changelog.map((line, i) => (
                <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
              ))}
            </ul>
          ) : null}

          {assessment.overlapWarning ? (
            <p className="text-[0.625rem] font-medium text-amber-800">
              Some overlaps may remain — review before saving.
            </p>
          ) : null}

          {onApply ? (
            <button
              type="button"
              onClick={onApply}
              className="mt-1 w-full rounded-md border border-violet-400 bg-violet-600 px-3 py-2 text-[0.6875rem] font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              Apply AI Layout Changes
            </button>
          ) : null}
        </>
      ) : null}
    </aside>
  )
}
