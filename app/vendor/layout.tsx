import type { Metadata } from 'next'
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
import { buildPrivatePortalMetadata } from '@/lib/seo/public-metadata'

export const metadata: Metadata = buildPrivatePortalMetadata('Popup Hub — Vendor')

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/vendor/dashboard')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  if (!hasAccessForProfile(profile, 'vendor')) {
    return <div className="min-h-0 flex-1 bg-cream">{children}</div>
  }

  const cookieStore = await cookies()
  const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value

  // Portal cookie is synced in middleware — do not call cookies().set() here (Next.js 16).

  return (
    <VendorShell profile={profile as Profile}>
      {children}
    </VendorShell>
  )
}
