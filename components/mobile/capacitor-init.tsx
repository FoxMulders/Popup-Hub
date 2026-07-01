'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { markNativeAppCookie, isNativeApp } from '@/lib/mobile/native-app'
import { closeNativeOAuthBrowser, markNativeOAuthDeepLinkReturn } from '@/lib/auth/native-oauth'
import { NativePushRegister } from '@/components/mobile/native-push-register'
import { syncNativeWidgetSession } from '@/lib/mobile/widget-sync'

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

    if (isNativeApp()) {
      document.documentElement.dataset.nativeApp = 'true'

      void import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide())
        .catch(() => undefined)

      void import('@capacitor/status-bar')
        .then(({ StatusBar, Style }) => {
          void StatusBar.setOverlaysWebView({ overlay: false })
          void StatusBar.setStyle({ style: Style.Dark })
          void StatusBar.setBackgroundColor({ color: '#faf8f5' })
        })
        .catch(() => undefined)
    }

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
              window.location.replace(
                query ? `/api/auth/callback?${query}` : '/api/auth/callback'
              )
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
        void syncNativeWidgetSession()
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
