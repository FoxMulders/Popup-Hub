'use client'

import { useEffect } from 'react'
import { flushPassportScanQueue } from '@/lib/pwa/passport-offline-queue'

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
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    void flushPassportScanQueue()

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
