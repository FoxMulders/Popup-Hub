'use client'

import { useEffect } from 'react'
import { flushPassportScanQueue } from '@/lib/pwa/passport-offline-queue'
import {
  flushCoordinatorOpsQueue,
  listAllPendingCoordinatorEventIds,
} from '@/lib/pwa/coordinator-ops-offline'

async function flushAllCoordinatorOpsQueues(): Promise<void> {
  const eventIds = new Set<string>(await listAllPendingCoordinatorEventIds())
  // Also flush the active event tab when the pathname includes an event id.
  if (typeof window !== 'undefined') {
    const match = window.location.pathname.match(/\/coordinator\/events\/([^/]+)/)
    if (match?.[1]) eventIds.add(match[1])
  }
  for (const eventId of eventIds) {
    await flushCoordinatorOpsQueue(eventId)
  }
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((error) => {
      console.error('[pwa] service worker registration failed', error)
    })

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PASSPORT_SCAN_FLUSH') {
        void flushPassportScanQueue()
      }
      if (event.data?.type === 'COORDINATOR_OPS_FLUSH') {
        void flushAllCoordinatorOpsQueues()
      }
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    void flushPassportScanQueue()
    void flushAllCoordinatorOpsQueues()

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
