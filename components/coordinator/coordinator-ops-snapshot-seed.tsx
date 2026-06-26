'use client'

import { useEffect } from 'react'
import {
  getCoordinatorOpsSnapshot,
  listPendingCoordinatorMutations,
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
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const pending = await listPendingCoordinatorMutations(eventId)
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      if (cancelled || (pending.length === 0 && !offline)) return
      const snapshot = await getCoordinatorOpsSnapshot(eventId)
      const cached = snapshot?.applications as T[] | undefined
      if (cached?.length && onHydrate) onHydrate(cached)
    })()
    return () => {
      cancelled = true
    }
  }, [eventId, onHydrate])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const pending = await listPendingCoordinatorMutations(eventId)
      if (cancelled || pending.length > 0) return
      await saveCoordinatorOpsSnapshot({
        eventId,
        eventName,
        applications,
        updatedAt: Date.now(),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [applications, eventId, eventName])

  return null
}
