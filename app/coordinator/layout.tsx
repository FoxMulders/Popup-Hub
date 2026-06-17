import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalSiteChrome } from '@/components/layout/portal-site-chrome'
import { hasAccessForProfile } from '@/lib/auth/rbac'
import {
  ACTIVE_PORTAL_COOKIE,
  getAvailablePortals,
  getDefaultDashboard,
  portalFromAccessiblePath,
} from '@/lib/portals/active-portal'
import { buildPrivatePortalMetadata } from '@/lib/seo/public-metadata'

export const metadata: Metadata = buildPrivatePortalMetadata('Popup Hub — Coordinator')

export default async function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[coordinator/layout] profile query failed', profileError.message)
  }
  if (!profile) redirect('/login')
  if (!hasAccessForProfile(profile, 'coordinator')) {
    redirect(getDefaultDashboard(profile.role, 0, undefined, { isAdmin: profile.is_admin }))
  }

  const cookieStore = await cookies()
  const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value

  const requiredPortal = portalFromAccessiblePath('/coordinator', profile.role, {
    isAdmin: profile.is_admin,
  })
  if (requiredPortal !== 'coordinator') {
    redirect(getDefaultDashboard(profile.role, 0))
  }

  // Portal cookie is synced in middleware — do not call cookies().set() here (Next.js 16).

  const availablePortals = getAvailablePortals(profile.role)

  return (
    <PortalSiteChrome
      portal="coordinator"
      profile={profile}
      availablePortals={availablePortals}
      portalCookie={portalCookie}
    >
      {children}
    </PortalSiteChrome>
  )
}
