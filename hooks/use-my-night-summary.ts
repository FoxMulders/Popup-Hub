'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MyNightSummary } from '@/lib/market-night/summary'

interface UseMyNightSummaryResult {
  summary: MyNightSummary | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useMyNightSummary(
  eventId: string,
  initialSummary?: MyNightSummary | null
): UseMyNightSummaryResult {
  const [summary, setSummary] = useState<MyNightSummary | null>(initialSummary ?? null)
  const [loading, setLoading] = useState(!initialSummary)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/events/${eventId}/my-night`)
      const json = (await res.json()) as { summary?: MyNightSummary; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Could not load your recap')
        return
      }
      setSummary(json.summary ?? null)
    } catch {
      setError('Network error loading recap')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    if (!initialSummary) {
      void refresh()
    }
  }, [initialSummary, refresh])

  return { summary, loading, error, refresh }
}
