'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PassportStoryView } from '@/lib/passport-stories/stories'

export function usePassportStories(ownerId: string, initialStories?: PassportStoryView[]) {
  const [stories, setStories] = useState<PassportStoryView[]>(initialStories ?? [])
  const [loading, setLoading] = useState(!initialStories)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/passport/stories?ownerId=${encodeURIComponent(ownerId)}`)
      const json = (await res.json()) as { stories?: PassportStoryView[]; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Could not load stories')
        return
      }
      setStories(json.stories ?? [])
    } catch {
      setError('Network error loading stories')
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  useEffect(() => {
    if (!initialStories) {
      void refresh()
    }
  }, [initialStories, refresh])

  return { stories, setStories, loading, error, refresh }
}
