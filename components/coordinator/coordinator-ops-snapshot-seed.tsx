'use client'

import { useEffect, useRef } from 'react'
import {
  hydrateCoordinatorOpsApplications,
  saveCoordinatorOpsSnapshot,
} from '@/lib/pwa/coordinator-ops-offline'

interface CoordinatorOpsSnapshotSeedProps<T extends { id: string }> {
  eventId: string
  eventName?: string | null
  applications: T[]
  onHydrate?: (applications: T[]) => void
}

export function CoordinatorOpsSnapshotSeed<T extends { id: string }>({
  eventId,
  eventName,
  applications,
  onHydrate,
}: CoordinatorOpsSnapshotSeedProps<T>) {
  const hydratedRef = useRef(false)
  const serverApplicationsRef = useRef(applications)
  serverApplicationsRef.current = applications

  useEffect(() => {
    let cancelled = false

    async function restoreOfflineState() {
      if (typeof navigator === 'undefined') {
        hydratedRef.current = true
        return
      }
      if (navigator.onLine) {
        hydratedRef.current = true
        return
      }

      const hydrated = await hydrateCoordinatorOpsApplications(
        eventId,
        serverApplicationsRef.current
      )
      if (cancelled) return
      if (hydrated && onHydrate) onHydrate(hydrated)
      hydratedRef.current = true
    }

    void restoreOfflineState()
    return () => {
      cancelled = true
    }
  }, [eventId, onHydrate])

  useEffect(() => {
    if (!hydratedRef.current) return
    void saveCoordinatorOpsSnapshot({
      eventId,
      eventName,
      applications,
      updatedAt: Date.now(),
    })
  }, [applications, eventId, eventName])

  return null
}
