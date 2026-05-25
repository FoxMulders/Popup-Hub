'use client'

import { useCharitableImpact } from '@/hooks/use-charitable-impact'
import { ImpactProgressBanner } from '@/components/charitable-impact/impact-progress-banner'
import { MilestoneCelebration } from '@/components/charitable-impact/milestone-celebration'
import { ImpactErrorBoundary } from '@/components/charitable-impact/impact-error-boundary'

interface CharitableImpactTrackerProps {
  eventId: string
  /** Optional live auction rows for smoother realtime increments. */
  livePoolCredits?: number[]
  livePaddleCredits?: number[]
  enabled?: boolean
  compact?: boolean
  className?: string
}

export function CharitableImpactTracker({
  eventId,
  livePoolCredits,
  livePaddleCredits,
  enabled = true,
  compact = false,
  className,
}: CharitableImpactTrackerProps) {
  const {
    loading,
    error,
    progress,
    totalCents,
    pendingCelebration,
    dismissCelebration,
  } = useCharitableImpact({
    eventId,
    livePoolCredits,
    livePaddleCredits,
    enabled,
  })

  if (!enabled) return null

  return (
    <ImpactErrorBoundary>
      <ImpactProgressBanner
        progress={progress}
        loading={loading}
        error={error}
        compact={compact}
        className={className}
      />
      <MilestoneCelebration
        milestone={pendingCelebration}
        totalCents={totalCents}
        onDismiss={dismissCelebration}
      />
    </ImpactErrorBoundary>
  )
}
