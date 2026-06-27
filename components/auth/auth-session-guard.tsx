'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isPublicPath } from '@/lib/auth/public-paths'
import { INTENTIONAL_SIGNOUT_KEY, signOutAndRedirectToLogin } from '@/lib/auth/sign-out'

function wasPageReload(): boolean {
  if (typeof window === 'undefined') return false
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return nav?.type === 'reload'
}

/** Redirect to login when the session ends on a protected route. */
export function AuthSessionGuard() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!pathname || isPublicPath(pathname)) return
    if (!wasPageReload()) return
    if (sessionStorage.getItem(INTENTIONAL_SIGNOUT_KEY)) return

    const supabase = createClient()

    void (async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        await signOutAndRedirectToLogin(supabase)
        return
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        await signOutAndRedirectToLogin(supabase)
      }
    })()
  }, [pathname])

  useEffect(() => {
    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_OUT' && session) return
      if (!pathname || isPublicPath(pathname)) return

      if (sessionStorage.getItem(INTENTIONAL_SIGNOUT_KEY)) {
        sessionStorage.removeItem(INTENTIONAL_SIGNOUT_KEY)
        router.replace('/login')
        return
      }

      const returnPath = `${pathname}${window.location.search}`
      router.replace(`/login?redirectTo=${encodeURIComponent(returnPath)}`)
    })

    return () => subscription.unsubscribe()
  }, [pathname, router])

  return null
}
