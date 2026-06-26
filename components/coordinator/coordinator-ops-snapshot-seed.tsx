'use client'

import { useEffect } from 'react'
import {
  getCoordinatorOpsSnapshot,
  listPendingCoordinatorMutations,
  saveCoordinatorOpsSnapshot,
  shouldHydrateCoordinatorOpsFromSnapshot,
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
    void saveCoordinatorOpsSnapshot({
      eventId,
      eventName,
      applications,
      updatedAt: Date.now(),
    })
  }, [applications, eventId, eventName])

  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.onLine || !onHydrate) return
    void listPendingCoordinatorMutations(eventId).then(async (pending) => {
      if (!shouldHydrateCoordinatorOpsFromSnapshot(pending.length)) return
      const snapshot = await getCoordinatorOpsSnapshot(eventId)
      const cached = snapshot?.applications as T[] | undefined
      if (cached?.length) onHydrate(cached)
    })
  }, [eventId, onHydrate])

  return null
}
