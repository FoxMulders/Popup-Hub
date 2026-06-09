import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { VendorShell } from '@/components/vendor/vendor-shell'
import { hasAccessForProfile } from '@/lib/auth/rbac'
import {
  ACTIVE_PORTAL_COOKIE,
  parseActivePortal,
} from '@/lib/portals/active-portal'

import type { Profile } from '@/types/database'

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/vendor/dashboard')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  if (!hasAccessForProfile(profile, 'vendor')) {
    return <div className="min-h-screen bg-cream">{children}</div>
  }

  const cookieStore = await cookies()
  const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value
  if (parseActivePortal(portalCookie) !== 'vendor') {
    cookieStore.set(ACTIVE_PORTAL_COOKIE, 'vendor', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  return (
    <VendorShell profile={profile as Profile}>
      {children}
    </VendorShell>
  )
}
