import { cookies } from 'next/headers'
import { AppNav } from '@/components/nav/app-nav'
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
  const availablePortals = getAvailablePortals(profile.role)

  return (
    <div className="market-page min-h-screen">
      <AppNav
        profile={profile}
        availablePortals={availablePortals}
        portalCookie={portalCookie}
        vendorPortal
      />
      <main>{children}</main>
    </div>
  )
}
