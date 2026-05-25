'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  computeCharityImpactProgress,
  findNewlyAchievedMilestones,
  markMilestoneCelebrated,
  parseCharityMilestones,
  readCelebratedMilestones,
  type CharityImpactProgress,
  type CharityMilestone,
} from '@/lib/charitable-impact/milestones'
import { computeTotalCentsFromLiveData } from '@/lib/charitable-impact/totals'

interface CharitableImpactResponse {
  totalCents: number
  milestones: CharityMilestone[]
  progress: CharityImpactProgress
}

interface UseCharitableImpactOptions {
  eventId: string
  /** When provided, optimistically merge live auction state between API polls. */
  livePoolCredits?: number[]
  livePaddleCredits?: number[]
  enabled?: boolean
}

interface UseCharitableImpactResult {
  loading: boolean
  error: string | null
  totalCents: number
  milestones: CharityMilestone[]
  progress: CharityImpactProgress
  refresh: () => Promise<void>
  pendingCelebration: CharityMilestone | null
  dismissCelebration: () => void
}

export function useCharitableImpact({
  eventId,
  livePoolCredits,
  livePaddleCredits,
  enabled = true,
}: UseCharitableImpactOptions): UseCharitableImpactResult {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCents, setTotalCents] = useState(0)
  const [milestones, setMilestones] = useState<CharityMilestone[]>([])
  const [pendingCelebration, setPendingCelebration] = useState<CharityMilestone | null>(null)
  const celebratedRef = useRef<Set<number>>(readCelebratedMilestones(eventId))
  const queueRef = useRef<CharityMilestone[]>([])

  const enqueueCelebrations = useCallback(
    (progress: CharityImpactProgress) => {
      const fresh = findNewlyAchievedMilestones(progress, celebratedRef.current)
      if (fresh.length === 0) return

      for (const milestone of fresh) {
        celebratedRef.current.add(milestone.amountCents)
        markMilestoneCelebrated(eventId, milestone.amountCents)
        queueRef.current.push(milestone)
      }

      if (!pendingCelebration && queueRef.current.length > 0) {
        setPendingCelebration(queueRef.current.shift() ?? null)
      }
    },
    [eventId, pendingCelebration]
  )

  const dismissCelebration = useCallback(() => {
    const next = queueRef.current.shift() ?? null
    setPendingCelebration(next)
  }, [])

  const applySnapshot = useCallback(
    (snapshot: CharitableImpactResponse) => {
      setTotalCents(snapshot.totalCents)
      setMilestones(snapshot.milestones)
      enqueueCelebrations(snapshot.progress)
    },
    [enqueueCelebrations]
  )

  const refresh = useCallback(async () => {
    if (!enabled) return
    setError(null)
    try {
      const res = await fetch(`/api/events/${eventId}/charitable-impact`)
      const json = (await res.json()) as CharitableImpactResponse & { error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Could not load impact data')
        return
      }
      applySnapshot(json)
    } catch {
      setError('Network error loading charitable impact')
    } finally {
      setLoading(false)
    }
  }, [applySnapshot, enabled, eventId])

  useEffect(() => {
    celebratedRef.current = readCelebratedMilestones(eventId)
    queueRef.current = []
    setPendingCelebration(null)
  }, [eventId])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void refresh()
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const channel = supabase
      .channel(`charity-impact:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_catalog_items',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void refresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_paddles',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, eventId, refresh])

  const optimisticTotalCents = useMemo(() => {
    if (!livePoolCredits && !livePaddleCredits) return null
    return computeTotalCentsFromLiveData({
      poolCreditsByItem: livePoolCredits ?? [],
      paddlePurchaseCredits: livePaddleCredits ?? [],
    })
  }, [livePoolCredits, livePaddleCredits])

  const resolvedTotalCents = optimisticTotalCents ?? totalCents

  const progress = useMemo(
    () => computeCharityImpactProgress(resolvedTotalCents, milestones),
    [resolvedTotalCents, milestones]
  )

  useEffect(() => {
    if (loading || milestones.length === 0) return
    enqueueCelebrations(progress)
  }, [enqueueCelebrations, loading, milestones.length, progress])

  return {
    loading,
    error,
    totalCents: resolvedTotalCents,
    milestones,
    progress,
    refresh,
    pendingCelebration,
    dismissCelebration,
  }
}

export { parseCharityMilestones }
