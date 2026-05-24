'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isPublicPath } from '@/lib/auth/public-paths'

/** Redirect to login when the session ends on a protected route. */
export function AuthSessionGuard() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_OUT' && session) return
      if (!pathname || isPublicPath(pathname)) return

      const returnPath = `${pathname}${window.location.search}`
      router.replace(`/login?redirectTo=${encodeURIComponent(returnPath)}`)
    })

    return () => subscription.unsubscribe()
  }, [pathname, router])

  return null
}
