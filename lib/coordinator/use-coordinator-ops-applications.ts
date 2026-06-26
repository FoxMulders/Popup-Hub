'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { listPendingCoordinatorMutations } from '@/lib/pwa/coordinator-ops-offline'

export function useCoordinatorOpsApplications<T>(
  eventId: string,
  initial: T[]
): [T[], Dispatch<SetStateAction<T[]>>] {
  const [apps, setApps] = useState<T[]>(initial)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const pending = await listPendingCoordinatorMutations(eventId)
      if (cancelled || pending.length > 0) return
      setApps(initial)
    })()
    return () => {
      cancelled = true
    }
  }, [eventId, initial])

  return [apps, setApps]
}
