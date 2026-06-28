'use client'

import { useCallback, useEffect, useState } from 'react'

export function usePublishAssistPending(eventId: string | null | undefined) {
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(Boolean(eventId))

  const refresh = useCallback(async () => {
    if (!eventId) {
      setPending(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/coordinator/events/${eventId}/publish-assist`)
      if (!res.ok) {
        setPending(false)
        return
      }
      const json = (await res.json()) as { pending?: { id: string } | null }
      setPending(Boolean(json.pending))
    } catch {
      setPending(false)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { pending, loading, refresh }
}
