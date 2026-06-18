'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { markNativeAppCookie } from '@/lib/mobile/native-app'

/** Capacitor listeners: native cookie marker + deep-link routing. */
export function CapacitorInit() {
  const router = useRouter()

  useEffect(() => {
    markNativeAppCookie()

    let removeUrlListener: (() => void) | undefined

    void import('@capacitor/app')
      .then(({ App }) => {
        void App.addListener('appUrlOpen', (event) => {
          try {
            const url = new URL(event.url)
            const path = `${url.pathname}${url.search}${url.hash}`
            if (path.startsWith('/')) {
              router.push(path)
            }
          } catch {
            /* ignore malformed URLs */
          }
        }).then((handle) => {
          removeUrlListener = () => void handle.remove()
        })
      })
      .catch(() => {
        /* @capacitor/app only available in native shell */
      })

    return () => {
      removeUrlListener?.()
    }
  }, [router])

  return null
}
