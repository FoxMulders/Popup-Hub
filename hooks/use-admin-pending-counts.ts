'use client'

import { useCallback, useEffect, useState } from 'react'

export interface AdminPendingCounts {
  featureRequests: number
  venueSubmissions: number
  organizerClaims: number
  publishAssist: number
  total: number
}

export function useAdminPendingCounts(enabled: boolean) {
  const [counts, setCounts] = useState<AdminPendingCounts>({
    featureRequests: 0,
    venueSubmissions: 0,
    organizerClaims: 0,
    publishAssist: 0,
    total: 0,
  })

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch('/api/admin/pending-counts', { credentials: 'same-origin' })
      if (!res.ok) return
      const json = (await res.json()) as AdminPendingCounts
      setCounts(json)
    } catch {
      /* ignore polling errors */
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(timer)
  }, [enabled, refresh])

  return { counts, refresh }
}
