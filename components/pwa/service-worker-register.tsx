'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((error) => {
      console.error('[pwa] service worker registration failed', error)
    })
  }, [])

  return null
}
