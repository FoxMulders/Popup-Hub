'use client'

import { useEffect, useRef } from 'react'
import {
  getCoordinatorOpsSnapshot,
  saveCoordinatorOpsSnapshot,
} from '@/lib/pwa/coordinator-ops-offline'

interface CoordinatorOpsSnapshotSeedProps<T> {
  eventId: string
  eventName?: string | null
  applications: T[]
  onHydrate?: (applications: T[]) => void
}

export function CoordinatorOpsSnapshotSeed<T>({
  eventId,
  eventName,
  applications,
  onHydrate,
}: CoordinatorOpsSnapshotSeedProps<T>) {
  const hydratedFromCacheRef = useRef(false)

  useEffect(() => {
    hydratedFromCacheRef.current = false
  }, [eventId])

  useEffect(() => {
    let cancelled = false

    async function persist() {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine

      // On an offline reload, server props are stale. Hydrate from IndexedDB
      // before persisting so we do not overwrite the cache with SSR data.
      if (offline && !hydratedFromCacheRef.current) {
        const snapshot = await getCoordinatorOpsSnapshot(eventId)
        if (cancelled) return

        const cached = snapshot?.applications as T[] | undefined
        if (cached?.length && onHydrate) {
          onHydrate(cached)
          hydratedFromCacheRef.current = true
          return
        }
        hydratedFromCacheRef.current = true
      }

      await saveCoordinatorOpsSnapshot({
        eventId,
        eventName,
        applications,
        updatedAt: Date.now(),
      })
    }

    void persist()
    return () => {
      cancelled = true
    }
  }, [applications, eventId, eventName, onHydrate])

  return null
}
