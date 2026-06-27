'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { markNativeAppCookie, isNativeApp } from '@/lib/mobile/native-app'
import { navigateToOAuthCallback } from '@/lib/auth/oauth-callback-navigation'
import { closeNativeOAuthBrowser, markNativeOAuthDeepLinkReturn } from '@/lib/auth/native-oauth'
import { NativePushRegister } from '@/components/mobile/native-push-register'

function resolveNativeLaunchPath(input: {
  role: string
  activePortal: string | null
  pathname: string
}): string | null {
  if (input.pathname !== '/discover' && input.pathname !== '/') return null

  if (input.role === 'vendor') {
    if (input.activePortal === 'patron') return null
    return '/vendor/events'
  }

  if (input.role === 'coordinator' && input.activePortal === 'coordinator') {
    return '/coordinator'
  }

  return null
}

/** Capacitor listeners: native cookie, deep links, role-aware launch, push registration. */
export function CapacitorInit() {
  const router = useRouter()
  const pathname = usePathname() ?? ''

  useEffect(() => {
    markNativeAppCookie()

    let removeUrlListener: (() => void) | undefined

    void import('@capacitor/app')
      .then(({ App }) => {
        void App.addListener('appUrlOpen', (event) => {
          try {
            const url = new URL(event.url)
            // OAuth return: ca.popuphub.app://auth/callback?code=...
            if (url.host === 'auth' && url.pathname.startsWith('/callback')) {
              const params = url.searchParams
              const query = params.toString()
              markNativeOAuthDeepLinkReturn()
              void closeNativeOAuthBrowser()
              navigateToOAuthCallback(query)
              return
            }
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

  useEffect(() => {
    if (!isNativeApp()) return
    if (pathname !== '/discover' && pathname !== '/') return

    void fetch('/api/mobile/session-bootstrap')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { authenticated?: boolean; role?: string; activePortal?: string | null } | null) => {
        if (!data?.authenticated || !data.role) return
        const next = resolveNativeLaunchPath({
          role: data.role,
          activePortal: data.activePortal ?? null,
          pathname,
        })
        if (next) router.replace(next)
      })
      .catch(() => undefined)
  }, [pathname, router])

  return <NativePushRegister />
}
