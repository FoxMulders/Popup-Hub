import { cookies } from 'next/headers'
import { PortalSiteChrome } from '@/components/layout/portal-site-chrome'
import {
  ACTIVE_PORTAL_COOKIE,
  getAvailablePortals,
} from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'

interface VendorShellProps {
  profile: Profile
  children: React.ReactNode
}

export async function VendorShell({ profile, children }: VendorShellProps) {
  const cookieStore = await cookies()
  const portalCookie = cookieStore.get(ACTIVE_PORTAL_COOKIE)?.value
  const availablePortals = getAvailablePortals(profile.role, { isAdmin: profile.is_admin })

  return (
    <PortalSiteChrome
      portal="vendor"
      profile={profile}
      availablePortals={availablePortals}
      portalCookie={portalCookie}
      vendorPortal
    >
      {children}
    </PortalSiteChrome>
  )
}
