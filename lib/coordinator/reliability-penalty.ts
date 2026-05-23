import type { EventCancellationReason } from '@/lib/coordinator/cancellation-reasons'
import { isEmergencyCancellationReason } from '@/lib/coordinator/cancellation-reasons'

export const NOTICE_WINDOW_DAYS = 7

/** Days from cancellation moment until event start (fractional). */
export function computeNoticeDays(cancelledAt: Date, eventStartAt: Date): number {
  const ms = eventStartAt.getTime() - cancelledAt.getTime()
  return Math.max(0, ms / (1000 * 60 * 60 * 24))
}

export function isLateCancellation(noticeDays: number, reason: EventCancellationReason): boolean {
  return noticeDays < NOTICE_WINDOW_DAYS && !isEmergencyCancellationReason(reason)
}

/**
 * Points to deduct from coordinator reliability_score (0–100 scale).
 * Emergency (force majeure): no penalty. Late non-emergency: tiered by notice window.
 */
export function computeCancellationPenalty(
  noticeDays: number,
  reason: EventCancellationReason
): number {
  if (isEmergencyCancellationReason(reason)) return 0
  if (noticeDays >= NOTICE_WINDOW_DAYS) return 5

  if (noticeDays < 3) return 25
  if (noticeDays < 7) return 15
  return 10
}

export interface CoordinatorPenaltyResult {
  noticeDays: number
  penaltyPoints: number
  isLate: boolean
  newReliabilityScore: number
  newCancellationCount: number
  newLateCancellationCount: number
  setRecentLateCancellation: boolean
}

export function applyCoordinatorReliabilityPenalty(params: {
  currentScore: number
  cancellationCount: number
  lateCancellationCount: number
  noticeDays: number
  reason: EventCancellationReason
}): CoordinatorPenaltyResult {
  const penaltyPoints = computeCancellationPenalty(params.noticeDays, params.reason)
  const isLate = isLateCancellation(params.noticeDays, params.reason)
  const newReliabilityScore = Math.max(0, params.currentScore - penaltyPoints)

  return {
    noticeDays: params.noticeDays,
    penaltyPoints,
    isLate,
    newReliabilityScore,
    newCancellationCount: params.cancellationCount + 1,
    newLateCancellationCount: params.lateCancellationCount + (isLate ? 1 : 0),
    setRecentLateCancellation: isLate,
  }
}
