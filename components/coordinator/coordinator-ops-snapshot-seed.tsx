'use client'

import { useEffect } from 'react'
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
  useEffect(() => {
    void saveCoordinatorOpsSnapshot({
      eventId,
      eventName,
      applications,
      updatedAt: Date.now(),
    })
  }, [applications, eventId, eventName])

  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.onLine) return
    void getCoordinatorOpsSnapshot(eventId).then((snapshot) => {
      const cached = snapshot?.applications as T[] | undefined
      if (cached?.length && onHydrate) onHydrate(cached)
    })
  }, [eventId, onHydrate])

  return null
}
