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
    let cancelled = false

    async function syncSnapshot() {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine

      if (offline && !hydratedFromCacheRef.current) {
        const snapshot = await getCoordinatorOpsSnapshot(eventId)
        const cached = snapshot?.applications as T[] | undefined
        if (!cancelled && cached?.length) {
          hydratedFromCacheRef.current = true
          onHydrate?.(cached)
          return
        }
      }

      if (cancelled) return

      await saveCoordinatorOpsSnapshot({
        eventId,
        eventName,
        applications,
        updatedAt: Date.now(),
      })
    }

    void syncSnapshot()

    return () => {
      cancelled = true
    }
  }, [applications, eventId, eventName, onHydrate])

  return null
}
