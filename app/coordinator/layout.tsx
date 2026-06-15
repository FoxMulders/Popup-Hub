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
  parseActivePortal,
  portalFromAccessiblePath,
} from '@/lib/portals/active-portal'
import { buildPrivatePortalMetadata } from '@/lib/seo/public-metadata'

export const metadata: Metadata = buildPrivatePortalMetadata('Popup Hub — Coordinator')

export default async function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!hasAccessForProfile(profile, 'coordinator')) {
    redirect(getDefaultDashboard(profile.role, 0, undefined, { isAdmin: profile.is_admin }))
  }

  const cookieStore = await cookies()
  const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value
  const availablePortals = getAvailablePortals(profile.role)

  const requiredPortal = portalFromAccessiblePath('/coordinator', profile.role, {
    isAdmin: profile.is_admin,
  })
  if (requiredPortal !== 'coordinator') {
    redirect(getDefaultDashboard(profile.role, 0))
  }

  if (parseActivePortal(portalCookie) !== 'coordinator') {
    cookieStore.set(ACTIVE_PORTAL_COOKIE, 'coordinator', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

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
