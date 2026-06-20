import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Shield } from 'lucide-react'

const RECENT_LATE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000

export function hasRecentLateCancellation(recentAt: string | null | undefined): boolean {
  if (!recentAt) return false
  return Date.now() - new Date(recentAt).getTime() < RECENT_LATE_WINDOW_MS
}

interface CoordinatorReliabilityBadgeProps {
  score: number
  recentLateCancellationAt?: string | null
  size?: 'sm' | 'md'
}

export function CoordinatorReliabilityBadge({
  score,
  recentLateCancellationAt,
  size = 'md',
}: CoordinatorReliabilityBadgeProps) {
  const showLateWarning = hasRecentLateCancellation(recentLateCancellationAt)
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  let scoreClass = 'bg-sage-100 text-sage-800'
  if (score < 70) scoreClass = 'bg-harvest-100 text-harvest-700'
  if (score < 50) scoreClass = 'bg-red-100 text-red-800'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className={`gap-1 ${scoreClass} ${textSize}`}>
        <Shield className="h-3 w-3" />
        Coordinator Reliability: {score}%
      </Badge>
      {showLateWarning && (
        <Badge className={`gap-1 bg-red-600 text-white font-bold uppercase ${textSize}`}>
          <AlertTriangle className="h-3 w-3" />
          Recent Late Cancellation
        </Badge>
      )}
    </div>
  )
}

/** Compact trust label for discover cards and list rows. */
export function CoordinatorTrustChip({
  score,
  className,
}: {
  score: number
  className?: string
}) {
  const tone =
    score >= 85 ? 'bg-sage-100 text-sage-800 border-sage-200' : score >= 70
      ? 'bg-harvest-50 text-harvest-800 border-harvest-200'
      : 'bg-red-50 text-red-800 border-red-200'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone} ${className ?? ''}`}
    >
      <Shield className="h-3 w-3" aria-hidden />
      {score}% trusted
    </span>
  )
}
