'use client'

import { useEffect, useRef, useState } from 'react'
import {
  getCoordinatorOpsSnapshot,
  saveCoordinatorOpsSnapshot,
} from '@/lib/pwa/coordinator-ops-offline'
import { resolveCoordinatorOpsSnapshotApplications } from '@/lib/pwa/coordinator-ops-snapshot-init'

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
  const [ready, setReady] = useState(false)
  const bootstrappedEventRef = useRef<string | null>(null)

  useEffect(() => {
    setReady(false)
    bootstrappedEventRef.current = null
  }, [eventId])

  useEffect(() => {
    if (bootstrappedEventRef.current === eventId) return

    let cancelled = false

    async function initializeSnapshot() {
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine
      const resolved = await resolveCoordinatorOpsSnapshotApplications({
        isOnline,
        eventId,
        serverApplications: applications,
        loadCachedApplications: async (cachedEventId) => {
          const snapshot = await getCoordinatorOpsSnapshot(cachedEventId)
          return (snapshot?.applications as T[] | undefined) ?? null
        },
      })

      if (cancelled) return

      if (resolved.hydratedFromCache && onHydrate) {
        onHydrate(resolved.applications)
      }

      await saveCoordinatorOpsSnapshot({
        eventId,
        eventName,
        applications: resolved.applications,
        updatedAt: Date.now(),
      })

      if (!cancelled) {
        bootstrappedEventRef.current = eventId
        setReady(true)
      }
    }

    void initializeSnapshot()

    return () => {
      cancelled = true
    }
  }, [applications, eventId, eventName, onHydrate])

  useEffect(() => {
    if (!ready || bootstrappedEventRef.current !== eventId) return
    void saveCoordinatorOpsSnapshot({
      eventId,
      eventName,
      applications,
      updatedAt: Date.now(),
    })
  }, [ready, applications, eventId, eventName])

  return null
}
