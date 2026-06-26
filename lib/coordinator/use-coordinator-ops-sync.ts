'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  flushCoordinatorOpsQueue,
  listPendingCoordinatorMutations,
} from '@/lib/pwa/coordinator-ops-offline'

export function useCoordinatorOpsSync(eventId: string) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refreshPendingCount = useCallback(async () => {
    const pending = await listPendingCoordinatorMutations(eventId)
    setPendingCount(pending.length)
  }, [eventId])

  const flushNow = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { synced: 0, failed: 0, remaining: pendingCount }
    }
    setSyncing(true)
    try {
      const result = await flushCoordinatorOpsQueue(eventId)
      await refreshPendingCount()
      return result
    } finally {
      setSyncing(false)
    }
  }, [eventId, pendingCount, refreshPendingCount])

  useEffect(() => {
    void refreshPendingCount()
  }, [refreshPendingCount])

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      void flushNow()
    }
    function handleOffline() {
      setIsOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flushNow])

  useEffect(() => {
    if (!isOnline) return
    const interval = window.setInterval(() => {
      void flushNow()
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [flushNow, isOnline])

  useEffect(() => {
    if (!isOnline) return
    let cancelled = false
    const ping = async () => {
      try {
        const res = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' })
        if (!cancelled && res.ok) void flushNow()
      } catch {
        // heartbeat failed — wait for online event
      }
    }
    const interval = window.setInterval(() => {
      void ping()
    }, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [flushNow, isOnline])

  return {
    isOnline,
    pendingCount,
    syncing,
    flushNow,
    refreshPendingCount,
  }
}
