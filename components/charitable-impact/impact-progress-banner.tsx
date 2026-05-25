'use client'

import { Heart, Loader2, Sparkles, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatImpactDollars,
  impactHeadline,
  type CharityImpactProgress,
} from '@/lib/charitable-impact/milestones'

interface ImpactProgressBannerProps {
  progress: CharityImpactProgress
  loading?: boolean
  error?: string | null
  className?: string
  compact?: boolean
}

export function ImpactProgressBanner({
  progress,
  loading = false,
  error = null,
  className,
  compact = false,
}: ImpactProgressBannerProps) {
  const headline = impactHeadline(progress)
  const achievedCount = progress.achievedMilestones.length
  const totalMilestones = progress.milestones.length

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900 text-white shadow-lg',
        className
      )}
      aria-label="Charitable impact tracker"
    >
      <div className={cn('px-4 py-4 sm:px-5', compact ? 'py-3' : 'py-4')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-emerald-100/90">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-widest">
                Charitable impact tracker
              </p>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-emerald-50/90">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating community total…
              </div>
            ) : error ? (
              <p className="text-sm text-red-200">{error}</p>
            ) : (
              <p className="text-sm font-medium leading-snug text-white sm:text-base">
                {headline}
              </p>
            )}
          </div>

          {!loading && !error ? (
            <div className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-right backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/80">
                Raised
              </p>
              <p className="text-xl font-bold tabular-nums tracking-tight">
                {formatImpactDollars(progress.totalCents)}
              </p>
            </div>
          ) : null}
        </div>

        {!loading && !error ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs text-emerald-100/85">
              <span className="inline-flex items-center gap-1">
                <Target className="h-3.5 w-3.5" />
                {progress.isComplete
                  ? 'All milestones funded'
                  : progress.nextMilestone
                    ? `Next: ${progress.nextMilestone.label}`
                    : 'Community goals'}
              </span>
              <span className="tabular-nums">
                {achievedCount}/{totalMilestones} milestones
              </span>
            </div>

            <div className="relative h-3 overflow-hidden rounded-full bg-emerald-950/60 ring-1 ring-white/15">
              <div
                className="charity-impact-progress-fill absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-300 via-lime-300 to-amber-200 shadow-[0_0_18px_rgba(110,231,183,0.45)]"
                style={{ width: `${progress.progressToNext}%` }}
              />
            </div>

            {progress.achievedMilestones.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {progress.achievedMilestones.map((m) => (
                  <span
                    key={m.amountCents}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-emerald-50"
                  >
                    <Heart className="h-3 w-3 fill-current text-rose-300" />
                    {m.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
